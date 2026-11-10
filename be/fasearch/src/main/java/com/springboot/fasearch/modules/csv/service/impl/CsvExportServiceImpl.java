package com.springboot.fasearch.modules.csv.service.impl;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToLongFunction;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.csv.CsvExportPlan;
import com.springboot.fasearch.modules.csv.CsvLabels;
import com.springboot.fasearch.modules.csv.CsvWriter;
import com.springboot.fasearch.modules.csv.service.interfaces.CsvExportService;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.inventory.repository.InventorySpecifications;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.repository.OrderSpecifications;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductSpecifications;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.MembershipTier;
import com.springboot.fasearch.modules.user.repository.CustomerSpecifications;
import com.springboot.fasearch.modules.user.repository.MembershipTierRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;

import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;

/**
 * Builds the admin CSV exports. Counting happens before the response is committed so the cap
 * refusal is a normal API error; rows are then written one bounded batch at a time and every
 * batch loads its associations in one extra query, so no row triggers a query of its own.
 */
@Service
@RequiredArgsConstructor
public class CsvExportServiceImpl implements CsvExportService {

    /** SCOPE 4.4: soft export cap, far above the current catalogue (12,001 SKUs). */
    public static final long MAX_ROWS = 50_000;
    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final String[] PRODUCT_HEADER = {
            "Mã sản phẩm", "Tên sản phẩm", "Danh mục", "Thương hiệu", "Model", "Chất liệu", "Kiểu dáng",
            "Giá bán", "Trạng thái sản phẩm", "Trạng thái xuất bản", "Mã SKU", "Màu", "Cỡ", "Mã vạch",
            "Giá cộng thêm", "Tồn vật lý", "Tồn tạm giữ", "Tồn khả dụng"
    };
    private static final String[] STOCK_HEADER = {
            "Mã SKU", "Mã sản phẩm", "Tên sản phẩm", "Màu", "Cỡ", "Mã vạch", "Tồn vật lý", "Tồn tạm giữ",
            "Tồn khả dụng", "Ngưỡng tối thiểu", "Trạng thái sản phẩm", "Cập nhật lúc"
    };
    private static final String[] ORDER_HEADER = {
            "Mã đơn", "Ngày tạo", "Trạng thái", "Trạng thái thanh toán", "Phương thức thanh toán",
            "Tên khách hàng", "Số điện thoại", "Địa chỉ giao hàng", "Tạm tính", "Giảm giá", "Giảm giá điểm",
            "Phí vận chuyển", "Tổng cộng", "Mã voucher", "Điểm nhận", "Điểm dùng"
    };
    private static final String[] CUSTOMER_HEADER = {
            "Mã khách hàng", "Họ", "Tên", "Giới tính", "Số điện thoại", "Ngày sinh", "Địa chỉ",
            "Điểm tích lũy", "Hạng thành viên", "Tổng chi tiêu đã thanh toán", "Hạng doanh số"
    };

    private final ProductVariantRepository productVariantRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;
    private final MembershipTierRepository membershipTierRepository;

    @Override
    public CsvExportPlan prepareProducts(String keyword, Long categoryId, BigDecimal minPrice,
            BigDecimal maxPrice, ProductStatus status, String brand, Long brandId) {
        Specification<Product> productSpec = ProductSpecifications.list(
                keyword, categoryId, minPrice, maxPrice, status, brand, brandId, true);
        Specification<ProductVariant> variantSpec = variantsOf(productSpec);
        long total = productVariantRepository.count(variantSpec);
        checkCap(total);
        return new CsvExportPlan(filename("san-pham"), total, out -> writeProducts(out, variantSpec));
    }

    @Override
    public CsvExportPlan prepareStock(String sku, String productName, String keyword) {
        Specification<Inventory> spec = InventorySpecifications.list(sku, productName, keyword);
        long total = inventoryRepository.count(spec);
        checkCap(total);
        return new CsvExportPlan(filename("ton-kho"), total, out -> writeStock(out, spec));
    }

    @Override
    public CsvExportPlan prepareOrders(OrderStatus status, String orderCode, String customerPhone,
            LocalDate startDate, LocalDate endDate, String keyword) {
        Specification<Order> spec = OrderSpecifications.list(
                null, status, orderCode, customerPhone, startDate, endDate, keyword);
        long total = orderRepository.count(spec);
        checkCap(total);
        return new CsvExportPlan(filename("don-hang"), total, out -> writeOrders(out, spec));
    }

    @Override
    public CsvExportPlan prepareCustomers(String keyword, Long tierId, Long salesTierId) {
        Specification<Customer> spec = CustomerSpecifications.list(
                keyword, tierId, salesTierId, membershipTierRepository);
        long total = userRepository.count(spec);
        checkCap(total);
        return new CsvExportPlan(filename("khach-hang"), total, out -> writeCustomers(out, spec));
    }

    private static Specification<ProductVariant> variantsOf(Specification<Product> productSpec) {
        return (root, query, cb) -> {
            Subquery<Long> matching = query.subquery(Long.class);
            Root<Product> product = matching.from(Product.class);
            matching.select(product.get("id"));
            matching.where(productSpec.toPredicate(product, query, cb));
            return root.get("product").get("id").in(matching);
        };
    }

    private void writeProducts(OutputStream out, Specification<ProductVariant> variantSpec) throws IOException {
        CsvWriter csv = new CsvWriter(out);
        csv.row((Object[]) PRODUCT_HEADER);
        forEachBatch(productVariantRepository, variantSpec, ProductVariant::getId, batch -> {
            List<Long> ids = batch.stream().map(ProductVariant::getId).toList();
            Map<Long, ProductVariant> full = byId(productVariantRepository.findExportRowsByIdIn(ids),
                    ProductVariant::getId);
            Map<Long, Inventory> stock = new HashMap<>();
            for (Inventory inventory : inventoryRepository.findByVariantIdIn(ids)) {
                stock.put(inventory.getVariant().getId(), inventory);
            }
            for (ProductVariant row : batch) {
                ProductVariant variant = full.getOrDefault(row.getId(), row);
                Product product = variant.getProduct();
                Inventory inventory = stock.get(variant.getId());
                csv.row(
                        product == null ? null : product.getId(),
                        product == null ? null : product.getProductName(),
                        product == null || product.getCategory() == null ? null : product.getCategory().getCategoryName(),
                        product == null || product.getBrand() == null ? null : product.getBrand().getName(),
                        product == null ? null : product.getModelCode(),
                        product == null ? null : product.getMaterial(),
                        product == null ? null : product.getStyle(),
                        product == null ? null : product.getPrice(),
                        product == null ? null : CsvLabels.productStatus(product.getStatus()),
                        product == null ? null : CsvLabels.publicationStatus(product.getPublicationStatus()),
                        variant.getId(),
                        variant.getColor(),
                        variant.getSize(),
                        variant.getBarcode(),
                        variant.getAdditionalPrice(),
                        inventory == null ? null : inventory.getPhysicalStock(),
                        inventory == null ? null : inventory.getReservedStock(),
                        inventory == null ? null : inventory.getAvailableStock());
            }
        });
        csv.flush();
    }

    private void writeStock(OutputStream out, Specification<Inventory> spec) throws IOException {
        CsvWriter csv = new CsvWriter(out);
        csv.row((Object[]) STOCK_HEADER);
        forEachBatch(inventoryRepository, spec, Inventory::getId, batch -> {
            List<Long> ids = batch.stream().map(Inventory::getId).toList();
            Map<Long, Inventory> full = byId(inventoryRepository.findExportRowsByIdIn(ids), Inventory::getId);
            for (Inventory row : batch) {
                Inventory inventory = full.getOrDefault(row.getId(), row);
                ProductVariant variant = inventory.getVariant();
                Product product = variant == null ? null : variant.getProduct();
                csv.row(
                        variant == null ? null : variant.getId(),
                        product == null ? null : product.getId(),
                        product == null ? null : product.getProductName(),
                        variant == null ? null : variant.getColor(),
                        variant == null ? null : variant.getSize(),
                        variant == null ? null : variant.getBarcode(),
                        inventory.getPhysicalStock(),
                        inventory.getReservedStock(),
                        inventory.getAvailableStock(),
                        inventory.getMinThreshold(),
                        product == null ? null : CsvLabels.productStatus(product.getStatus()),
                        inventory.getUpdatedAt());
            }
        });
        csv.flush();
    }

    private void writeOrders(OutputStream out, Specification<Order> spec) throws IOException {
        CsvWriter csv = new CsvWriter(out);
        csv.row((Object[]) ORDER_HEADER);
        forEachBatch(orderRepository, spec, Order::getId, batch -> {
            List<Long> ids = batch.stream().map(Order::getId).toList();
            Map<Long, Order> full = byId(orderRepository.findExportRowsByIdIn(ids), Order::getId);
            Map<Long, Invoice> paidByOrder = new HashMap<>();
            for (Invoice invoice : invoiceRepository.findByOrderIds(ids)) {
                if ((invoice.getStatus() == PaymentStatus.PAID || invoice.getStatus() == PaymentStatus.REFUNDED) && invoice.getOrder() != null) {
                    paidByOrder.put(invoice.getOrder().getId(), invoice);
                }
            }
            Map<Long, BigDecimal> refundedByOrder = new HashMap<>();
            for(Object[] refund : invoiceRepository.refundedByOrderIds(ids))
                refundedByOrder.put(((Number)refund[0]).longValue(),(BigDecimal)refund[1]);
            for (Order row : batch) {
                Order order = full.getOrDefault(row.getId(), row);
                Customer customer = order.getCustomer();
                Invoice paid = paidByOrder.get(order.getId());
                BigDecimal totalAmount = order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount();
                BigDecimal shipping = order.getShippingFee() == null ? BigDecimal.ZERO : order.getShippingFee();
                BigDecimal discount = order.getDiscountAmount() == null ? BigDecimal.ZERO : order.getDiscountAmount();
                BigDecimal points = order.getPointsDiscount() == null ? BigDecimal.ZERO : order.getPointsDiscount();
                csv.row(
                        order.getOrderCode(),
                        order.getOrderDate(),
                        CsvLabels.orderStatus(order.getStatus()),
                        paid == null ? "Chưa thanh toán" : paid.getStatus()==PaymentStatus.REFUNDED ? "Đã hoàn tiền" : refundedByOrder.getOrDefault(order.getId(),BigDecimal.ZERO).signum()>0 ? "Đã hoàn một phần" : CsvLabels.paymentStatus(paid.getStatus()),
                        paid == null ? null : CsvLabels.paymentMethod(paid.getPaymentMethodCode()),
                        fullName(customer),
                        customer == null ? null : customer.getPhoneNumber(),
                        order.getDeliveryAddress(),
                        totalAmount.subtract(shipping).add(discount).add(points),
                        discount,
                        points,
                        shipping,
                        (paid == null ? totalAmount : paid.getTotalActualPaid()).subtract(refundedByOrder.getOrDefault(order.getId(),BigDecimal.ZERO)),
                        order.getVoucherCode(),
                        order.getEarnedPoints(),
                        order.getRedeemedPoints());
            }
        });
        csv.flush();
    }

    private void writeCustomers(OutputStream out, Specification<Customer> spec) throws IOException {
        List<MembershipTier> salesTiers = membershipTierRepository.findAll().stream()
                .filter(tier -> tier.getMinimumCumulativePaidSales() != null)
                .toList();
        CsvWriter csv = new CsvWriter(out);
        csv.row((Object[]) CUSTOMER_HEADER);
        forEachBatch(userRepository, spec, Customer::getId, batch -> {
            List<Long> ids = batch.stream().map(Customer::getId).toList();
            Map<Long, Customer> full = byId(userRepository.findExportRowsByIdIn(ids), Customer::getId);
            Map<Long, BigDecimal> paidByCustomer = new HashMap<>();
            for (Object[] row : invoiceRepository.sumActualPaidByCustomerIdsAndStatus(ids, PaymentStatus.PAID)) {
                paidByCustomer.put((Long) row[0], (BigDecimal) row[1]);
            }
            for (Customer row : batch) {
                Customer customer = full.getOrDefault(row.getId(), row);
                BigDecimal paid = Boolean.TRUE.equals(customer.getSalesHistoryComplete())
                        ? paidByCustomer.getOrDefault(customer.getId(), BigDecimal.ZERO) : null;
                csv.row(
                        customer.getId(),
                        customer.getLastName(),
                        customer.getFirstName(),
                        CsvLabels.gender(customer.getGender()),
                        customer.getPhoneNumber(),
                        customer.getDob(),
                        customer.getAddress(),
                        customer.getAccumulatePoint(),
                        customer.getMembershipTier() == null ? null : customer.getMembershipTier().getTierName(),
                        paid,
                        salesTierName(salesTiers, paid));
            }
        });
        csv.flush();
    }

    private static <T> void forEachBatch(JpaSpecificationExecutor<T> repository, Specification<T> base,
            ToLongFunction<T> idOf, BatchConsumer<T> consumer) throws IOException {
        long lastId = 0;
        while (true) {
            long after = lastId;
            List<T> batch = repository.findBy(base.and(idGreaterThan(after)),
                    query -> query.sortBy(Sort.by(Sort.Direction.ASC, "id")).limit(CsvWriter.BATCH_SIZE).all());
            if (batch.isEmpty()) {
                return;
            }
            consumer.accept(batch);
            lastId = idOf.applyAsLong(batch.get(batch.size() - 1));
            if (batch.size() < CsvWriter.BATCH_SIZE) {
                return;
            }
        }
    }

    private static <T> Specification<T> idGreaterThan(long lastId) {
        return (root, query, cb) -> cb.greaterThan(root.<Long>get("id"), lastId);
    }

    private static <T> Map<Long, T> byId(List<T> rows, java.util.function.Function<T, Long> idOf) {
        Map<Long, T> map = new HashMap<>();
        for (T row : rows) {
            map.put(idOf.apply(row), row);
        }
        return map;
    }

    private static String fullName(Customer customer) {
        if (customer == null) {
            return "";
        }
        String first = customer.getFirstName() == null ? "" : customer.getFirstName();
        String last = customer.getLastName() == null ? "" : customer.getLastName();
        return (first + " " + last).trim();
    }

    private static String salesTierName(List<MembershipTier> configured, BigDecimal paid) {
        if (paid == null || configured.isEmpty()) {
            return "";
        }
        return configured.stream()
                .filter(tier -> tier.getMinimumCumulativePaidSales().compareTo(paid) <= 0)
                .max(Comparator.comparing(MembershipTier::getMinimumCumulativePaidSales)
                        .thenComparing(MembershipTier::getId))
                .map(MembershipTier::getTierName)
                .orElse("");
    }

    private static void checkCap(long rows) {
        if (rows > MAX_ROWS) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tập dữ liệu có " + rows + " dòng, vượt giới hạn xuất " + MAX_ROWS
                            + " dòng. Hãy thu hẹp bộ lọc rồi thử lại.");
        }
    }

    private static String filename(String dataset) {
        return dataset + "-" + LocalDate.now(VIETNAM) + ".csv";
    }

    @FunctionalInterface
    private interface BatchConsumer<T> {
        void accept(List<T> batch) throws IOException;
    }
}
