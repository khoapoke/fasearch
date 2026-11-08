package com.springboot.fasearch.modules.order;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.order.dto.response.OrderDetailRes;
import com.springboot.fasearch.modules.order.dto.response.OrderRes;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.entity.OrderDetailId;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
import com.springboot.fasearch.modules.order.repository.CheckoutIdempotencyRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.service.impl.OrderServiceImpl;
import com.springboot.fasearch.modules.order.service.interfaces.ShippingService;
import com.springboot.fasearch.modules.payment.dto.request.PaymentProcessReq;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.payment.entity.PaymentMethod;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentMethodRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentRepository;
import com.springboot.fasearch.modules.payment.service.impl.PaymentServiceImpl;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.EmployeeRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.shared.PageResponse;
class OrderNullTotalTest {
    private OrderRepository orders() { return mock(OrderRepository.class); }
    private OrderServiceImpl service(OrderRepository orderRepository) {
        return new OrderServiceImpl(orderRepository, mock(InvoiceRepository.class), mock(CartRepository.class),
                mock(CartItemRepository.class), mock(UserRepository.class), mock(EmployeeRepository.class),
                mock(InventoryRepository.class), mock(ProductVariantRepository.class),
                mock(CheckoutBenefitService.class), mock(ShippingService.class), mock(LoyaltyService.class),
                mock(CheckoutIdempotencyRepository.class), mock(com.springboot.fasearch.modules.payment.service.impl.CancelledOrderStripeExpiry.class),
                mock(com.springboot.fasearch.modules.order.service.impl.OrderItemHistoryBuilder.class));
    }
    private OrderServiceImpl serviceWith(OrderRepository orderRepository, InvoiceRepository invoices, UserRepository users) {
        return new OrderServiceImpl(orderRepository, invoices, mock(CartRepository.class),
                mock(CartItemRepository.class), users, mock(EmployeeRepository.class),
                mock(InventoryRepository.class), mock(ProductVariantRepository.class),
                mock(CheckoutBenefitService.class), mock(ShippingService.class), mock(LoyaltyService.class),
                mock(CheckoutIdempotencyRepository.class), mock(com.springboot.fasearch.modules.payment.service.impl.CancelledOrderStripeExpiry.class),
                mock(com.springboot.fasearch.modules.order.service.impl.OrderItemHistoryBuilder.class));
    }
    private void asAdmin() {
        Authentication auth = new UsernamePasswordAuthenticationToken("admin", "x",
                com.springboot.fasearch.security.TestAuthorities.forRole("ADMIN"));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
    private void asCustomer(String username) {
        Authentication auth = new UsernamePasswordAuthenticationToken(username, "x",
                com.springboot.fasearch.security.TestAuthorities.forRole("CUSTOMER"));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }
    private Order order(Long id, String code, BigDecimal total) {
        return Order.builder().id(id).orderCode(code).status(OrderStatus.PENDING)
                .shippingFee(new BigDecimal("30000")).discountAmount(new BigDecimal("20000"))
                .pointsDiscount(new BigDecimal("5000")).redeemedPoints(0).totalAmount(total).build();
    }
    private OrderDetail line(long skuId, String price, int qty) {
        Product product = Product.builder().id(skuId).productName("SKU-" + skuId).price(new BigDecimal(price)).build();
        ProductVariant variant = ProductVariant.builder().id(skuId).product(product).build();
        return OrderDetail.builder().id(new OrderDetailId(null, skuId)).variant(variant)
                .quantity(qty).unitPrice(new BigDecimal(price))
                .discountAmount(BigDecimal.ZERO).pointsDiscountAmount(BigDecimal.ZERO).build();
    }
    private Order orderWithLines(Long id, String code, BigDecimal total) {
        Order o = order(id, code, total);
        OrderDetail d1 = line(101L, "99000", 1);
        OrderDetail d2 = line(102L, "100000", 2);
        d1.setOrder(o);
        d2.setOrder(o);
        o.setDetails(new java.util.ArrayList<>(List.of(d1, d2)));
        return o;
    }
    @Test void listWithOneNullTotalDoesNotThrow() {
        OrderRepository repo = orders();
        Order normal = order(1L, "DH-0001", new BigDecimal("299000"));
        Order nullTotal = order(2L, "DH-0002", null);
        when(repo.findAll(any(Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(normal, nullTotal), PageRequest.of(0, 10), 2));
        asAdmin();
        PageResponse<OrderRes> page = service(repo).getOrders(PageRequest.of(0, 10), null, null, null, null, null, null);
        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getContent().get(0).getTotalAmount()).isEqualByComparingTo("299000");
        assertThat(page.getContent().get(0).getSubTotal()).isEqualByComparingTo("294000");
        assertThat(page.getContent().get(1).getTotalAmount()).isEqualByComparingTo("0");
        assertThat(page.getContent().get(1).getSubTotal()).isEqualByComparingTo("0");
    }
    @Test void singleOrderWithNullTotalDoesNotThrow() throws Exception {
        Method toOrderRes = OrderServiceImpl.class.getDeclaredMethod("toOrderRes", Order.class, boolean.class);
        toOrderRes.setAccessible(true);
        OrderRes res = (OrderRes) toOrderRes.invoke(service(orders()), order(9L, "DH-0009", null), false);
        assertThat(res.getTotalAmount()).isEqualByComparingTo("0");
        assertThat(res.getSubTotal()).isEqualByComparingTo("0");
    }
    @Test void detailPathWithNullTotalUsesLineItemSum() throws Exception {
        Method mapToDetail = OrderServiceImpl.class.getDeclaredMethod("mapToOrderDetailRes", Order.class);
        mapToDetail.setAccessible(true);
        Order nullOrder = orderWithLines(11L, "DH-0011", null);
        OrderDetailRes nullRes = (OrderDetailRes) mapToDetail.invoke(service(orders()), nullOrder);
        assertThat(nullRes.getTotalAmount()).isEqualByComparingTo("0");
        assertThat(nullRes.getSubTotal()).isEqualByComparingTo("299000");
        Order normalOrder = orderWithLines(12L, "DH-0012", new BigDecimal("299000"));
        OrderDetailRes normalRes = (OrderDetailRes) mapToDetail.invoke(service(orders()), normalOrder);
        assertThat(normalRes.getTotalAmount()).isEqualByComparingTo("299000");
        assertThat(normalRes.getSubTotal()).isEqualByComparingTo("299000");
    }
    @Test void nonNullSubtotalArithmeticPinned() throws Exception {
        Method toOrderRes = OrderServiceImpl.class.getDeclaredMethod("toOrderRes", Order.class, boolean.class);
        toOrderRes.setAccessible(true);
        Order o = Order.builder().id(7L).orderCode("DH-0007").status(OrderStatus.PENDING)
                .shippingFee(new BigDecimal("15000")).discountAmount(new BigDecimal("10000"))
                .pointsDiscount(new BigDecimal("2000")).redeemedPoints(0)
                .totalAmount(new BigDecimal("100000")).build();
        OrderRes res = (OrderRes) toOrderRes.invoke(service(orders()), o, false);
        assertThat(res.getSubTotal()).isEqualByComparingTo("97000");
        assertThat(res.getTotalAmount()).isEqualByComparingTo("100000");
    }
    @Test void detailPaidInvoiceMapping() {
        OrderRepository repo = orders();
        InvoiceRepository invoices = mock(InvoiceRepository.class);
        UserRepository users = mock(UserRepository.class);
        Customer customer = Customer.builder().id(61L).firstName("Tran").lastName("Test").phoneNumber("0911000000").build();
        Order o = orderWithLines(90L, "DH-0090", new BigDecimal("5965000"));
        o.setCustomer(customer);
        when(repo.findById(90L)).thenReturn(Optional.of(o));
        when(users.findByAccount_Username("cust")).thenReturn(Optional.of(customer));
        Invoice paid = Invoice.builder().id(47L).invoiceCode("HD-TEST-001").order(o)
                .paymentMethodCode(PaymentMethodType.STRIPE).totalActualPaid(new BigDecimal("5965000"))
                .status(PaymentStatus.PAID).build();
        when(invoices.findByOrderId(90L)).thenReturn(Optional.of(paid));
        asCustomer("cust");
        OrderDetailRes res = serviceWith(repo, invoices, users).getOrderById(90L);
        assertThat(res.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(res.getPaymentMethod()).isEqualTo(PaymentMethodType.STRIPE);
    }
    @Test void detailUnpaidMappingIsNull() {
        OrderRepository repo = orders();
        InvoiceRepository invoices = mock(InvoiceRepository.class);
        UserRepository users = mock(UserRepository.class);
        Customer customer = Customer.builder().id(61L).firstName("Tran").lastName("Test").phoneNumber("0911000000").build();
        Order o = orderWithLines(94L, "DH-0094", new BigDecimal("225000"));
        o.setCustomer(customer);
        when(repo.findById(94L)).thenReturn(Optional.of(o));
        when(users.findByAccount_Username("cust")).thenReturn(Optional.of(customer));
        when(invoices.findByOrderId(94L)).thenReturn(Optional.empty());
        asCustomer("cust");
        OrderDetailRes res = serviceWith(repo, invoices, users).getOrderById(94L);
        assertThat(res.getPaymentStatus()).isNull();
        assertThat(res.getPaymentMethod()).isNull();
    }
    private PaymentServiceImpl paymentService(OrderRepository orderRepo, InvoiceRepository invoiceRepo,
            PaymentMethodRepository methodRepo, PaymentRepository paymentRepo) {
        return new PaymentServiceImpl(orderRepo, mock(UserRepository.class), mock(EmployeeRepository.class),
                methodRepo, invoiceRepo, paymentRepo, mock(InventoryRepository.class),
                mock(CheckoutBenefitService.class), mock(LoyaltyService.class));
    }
    private PaymentMethod cashMethod() {
        return PaymentMethod.builder().id(1L).name("Cash").type(PaymentMethodType.CASH).status("ACTIVE").build();
    }
    @Test void nullTotalCashCollectionRejectedWithoutInvoiceWrite() {
        OrderRepository orderRepo = orders();
        InvoiceRepository invoiceRepo = mock(InvoiceRepository.class);
        PaymentMethodRepository methodRepo = mock(PaymentMethodRepository.class);
        PaymentRepository paymentRepo = mock(PaymentRepository.class);
        Order o = Order.builder().id(77L).orderCode("DH-0077").status(OrderStatus.PENDING)
                .shippingFee(new BigDecimal("25000")).discountAmount(BigDecimal.ZERO)
                .pointsDiscount(BigDecimal.ZERO).redeemedPoints(0).totalAmount(null).build();
        when(orderRepo.findByIdForUpdate(77L)).thenReturn(Optional.of(o));
        when(invoiceRepo.findByOrderId(77L)).thenReturn(Optional.empty());
        when(methodRepo.findByTypeAndStatus(PaymentMethodType.CASH, "ACTIVE")).thenReturn(Optional.of(cashMethod()));
        asAdmin();
        PaymentProcessReq req = PaymentProcessReq.builder().orderId(77L)
                .paymentMethodCode(PaymentMethodType.CASH).amountPaid(new BigDecimal("0")).build();
        assertThatThrownBy(() -> paymentService(orderRepo, invoiceRepo, methodRepo, paymentRepo).processPayment(req))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
        verify(invoiceRepo, never()).save(any(Invoice.class));
        verify(paymentRepo, never()).save(any());
    }
    @Test void listBatchedPaidMappingCoversAllRows() {
        OrderRepository repo = orders();
        InvoiceRepository invoices = mock(InvoiceRepository.class);
        Order first = order(21L, "DH-0021", new BigDecimal("100000"));
        Order second = order(22L, "DH-0022", new BigDecimal("200000"));
        Order unpaid = order(23L, "DH-0023", new BigDecimal("300000"));
        when(repo.findAll(any(Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(first, second, unpaid), PageRequest.of(0, 10), 3));
        Invoice paidFirst = Invoice.builder().id(101L).order(first)
                .paymentMethodCode(PaymentMethodType.STRIPE).totalActualPaid(new BigDecimal("100000"))
                .status(PaymentStatus.PAID).build();
        Invoice paidSecond = Invoice.builder().id(102L).order(second)
                .paymentMethodCode(PaymentMethodType.CASH).totalActualPaid(new BigDecimal("200000"))
                .status(PaymentStatus.PAID).build();
        when(invoices.findByOrderIds(List.of(21L, 22L, 23L))).thenReturn(List.of(paidFirst, paidSecond));
        asAdmin();
        OrderServiceImpl svc = serviceWith(repo, invoices, mock(UserRepository.class));
        PageResponse<OrderRes> page = svc.getOrders(PageRequest.of(0, 10), null, null, null, null, null, null);
        assertThat(page.getContent()).hasSize(3);
        assertThat(page.getContent().get(0).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(page.getContent().get(0).getPaymentMethod()).isEqualTo(PaymentMethodType.STRIPE);
        assertThat(page.getContent().get(1).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(page.getContent().get(1).getPaymentMethod()).isEqualTo(PaymentMethodType.CASH);
        assertThat(page.getContent().get(2).getPaymentStatus()).isNull();
        assertThat(page.getContent().get(2).getPaymentMethod()).isNull();
        verify(invoices, times(1)).findByOrderIds(List.of(21L, 22L, 23L));
    }

    @Test void listEmptyPageSkipsInvoiceLookup() {
        OrderRepository repo = orders();
        InvoiceRepository invoices = mock(InvoiceRepository.class);
        when(repo.findAll(any(Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));
        asAdmin();
        PageResponse<OrderRes> page = serviceWith(repo, invoices, mock(UserRepository.class))
                .getOrders(PageRequest.of(0, 10), null, null, null, null, null, null);
        assertThat(page.getContent()).isEmpty();
        verify(invoices, never()).findByOrderIds(any());
    }

    @Test void zeroTotalCashCollectionStillAllowed() {
        OrderRepository orderRepo = orders();
        InvoiceRepository invoiceRepo = mock(InvoiceRepository.class);
        PaymentMethodRepository methodRepo = mock(PaymentMethodRepository.class);
        PaymentRepository paymentRepo = mock(PaymentRepository.class);
        Order o = Order.builder().id(78L).orderCode("DH-0078").status(OrderStatus.PENDING)
                .shippingFee(BigDecimal.ZERO).discountAmount(BigDecimal.ZERO)
                .pointsDiscount(BigDecimal.ZERO).redeemedPoints(0).totalAmount(BigDecimal.ZERO).build();
        when(orderRepo.findByIdForUpdate(78L)).thenReturn(Optional.of(o));
        when(orderRepo.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(invoiceRepo.findByOrderId(78L)).thenReturn(Optional.empty());
        when(methodRepo.findByTypeAndStatus(PaymentMethodType.CASH, "ACTIVE")).thenReturn(Optional.of(cashMethod()));
        when(invoiceRepo.countByInvoiceCodeStartingWith(anyString())).thenReturn(0L);
        when(invoiceRepo.existsByInvoiceCode(anyString())).thenReturn(false);
        when(invoiceRepo.save(any(Invoice.class))).thenAnswer(inv -> {
            Invoice in = inv.getArgument(0);
            in.setId(99L);
            return in;
        });
        asAdmin();
        PaymentProcessReq req = PaymentProcessReq.builder().orderId(78L)
                .paymentMethodCode(PaymentMethodType.CASH).amountPaid(new BigDecimal("0")).build();
        var result = paymentService(orderRepo, invoiceRepo, methodRepo, paymentRepo).processPayment(req);
        assertThat(result.receipt().getTotalActualPaid()).isEqualByComparingTo("0");
        verify(invoiceRepo, times(1)).save(any(Invoice.class));
        verify(paymentRepo, never()).save(any());
    }
}
