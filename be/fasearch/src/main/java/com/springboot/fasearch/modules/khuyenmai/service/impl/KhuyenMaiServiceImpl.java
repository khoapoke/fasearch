package com.springboot.fasearch.modules.khuyenmai.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CampaignCreateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CampaignUpdateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CodeCreateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CampaignResponse;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CodeResponse;
import com.springboot.fasearch.modules.khuyenmai.dto.response.PublicOfferRes;
import com.springboot.fasearch.modules.khuyenmai.entity.KhuyenMai;
import com.springboot.fasearch.modules.khuyenmai.entity.MaGiamGia;
import com.springboot.fasearch.modules.khuyenmai.repository.KhuyenMaiRepository;
import com.springboot.fasearch.modules.khuyenmai.repository.MaGiamGiaRepository;
import com.springboot.fasearch.modules.khuyenmai.service.CampaignEffectiveState;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.KhuyenMaiService;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class KhuyenMaiServiceImpl implements KhuyenMaiService {
    private final KhuyenMaiRepository campaignRepository;
    private final MaGiamGiaRepository codeRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional
    public CampaignResponse create(CampaignCreateRequest request) {
        validateWindow(request.getNgayBatDau(), request.getNgayKetThuc());
        String type = normalizeType(request.getLoaiGiam());
        validateValue(type, request.getGiaTriGiam());
        Set<Long> scope = validateScope(request.getMaSpApDung());
        KhuyenMai saved = campaignRepository.save(KhuyenMai.builder()
                .name(request.getTenCtkm().strip()).discountType(type).discountValue(request.getGiaTriGiam())
                .startAt(request.getNgayBatDau()).endAt(request.getNgayKetThuc())
                .conditionText(blankToNull(request.getDieuKienApDung())).status("TAM_DUNG")
                .version(0L).productScope(scope).build());
        return campaign(saved, List.of());
    }

    @Override
    @Transactional
    public CampaignResponse update(Long id, CampaignUpdateRequest request) {
        KhuyenMai campaign = campaignRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy chiến dịch."));
        if (!campaign.getVersion().equals(request.getPhienBan())) {
            throw new AppException(ErrorCode.CAMPAIGN_VERSION_CHANGED);
        }
        LocalDateTime start = request.getNgayBatDau() == null ? campaign.getStartAt() : request.getNgayBatDau();
        LocalDateTime end = request.getNgayKetThuc() == null ? campaign.getEndAt() : request.getNgayKetThuc();
        validateWindow(start, end);
        String type = request.getLoaiGiam() == null ? campaign.getDiscountType() : normalizeType(request.getLoaiGiam());
        BigDecimal value = request.getGiaTriGiam() == null ? campaign.getDiscountValue() : request.getGiaTriGiam();
        validateValue(type, value);
        Set<Long> scope = request.getMaSpApDung() == null ? campaign.getProductScope() : validateScope(request.getMaSpApDung());
        String status = request.getTrangThai() == null ? campaign.getStatus() : request.getTrangThai().strip().toUpperCase(Locale.ROOT);
        if (!Set.of("HOAT_DONG", "TAM_DUNG").contains(status)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Trạng thái chiến dịch không được hỗ trợ.");
        }
        if (request.getTenCtkm() != null) {
            if (request.getTenCtkm().isBlank()) throw new AppException(ErrorCode.INVALID_REQUEST, "Tên chiến dịch không được để trống.");
            campaign.setName(request.getTenCtkm().strip());
        }
        campaign.setDiscountType(type);
        campaign.setDiscountValue(value);
        campaign.setStartAt(start);
        campaign.setEndAt(end);
        if (request.getDieuKienApDung() != null) campaign.setConditionText(blankToNull(request.getDieuKienApDung()));
        if (request.getMaSpApDung() != null) campaign.setProductScope(new HashSet<>(scope));
        campaign.setStatus(status);
        campaign.setVersion(campaign.getVersion() + 1);
        campaignRepository.save(campaign);
        return campaign(campaign, codes(id));
    }

    @Override
    @Transactional(readOnly = true)
    public CampaignResponse get(Long id) {
        KhuyenMai campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy chiến dịch."));
        return campaign(campaign, codes(id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CampaignResponse> list(String status, String effectiveState, String type, String query, PageRequest page) {
        CampaignEffectiveState effective;
        try {
            effective = CampaignEffectiveState.parse(effectiveState);
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Bộ lọc trạng thái hiệu lực của chiến dịch không được hỗ trợ.");
        }
        LocalDateTime now = LocalDateTime.now();
        String normalizedStatus = status == null || status.isBlank() ? null : status.strip().toUpperCase(Locale.ROOT);
        String normalizedType = type == null || type.isBlank() ? null : normalizeType(type);
        if (normalizedStatus != null && !Set.of("HOAT_DONG", "TAM_DUNG").contains(normalizedStatus)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Bộ lọc trạng thái chiến dịch không được hỗ trợ.");
        }
        String search = query == null || query.isBlank() ? null : escapeLike(query.strip().toLowerCase(Locale.ROOT));
        PageRequest stablePage = PageRequest.of(page.getPageNumber(), page.getPageSize(), Sort.by(Sort.Direction.DESC, "id"));
        Page<KhuyenMai> rows = campaignRepository.findAll((root, criteria, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
            if (normalizedStatus != null) predicates.add(cb.equal(root.get("status"), normalizedStatus));
            if (effective != null) predicates.add(effective.toPredicate(root, cb, now));
            if (normalizedType != null) predicates.add(cb.equal(root.get("discountType"), normalizedType));
            if (search != null) predicates.add(cb.like(cb.lower(root.get("name")), "%" + search + "%", '\\'));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        }, stablePage);
        return PageResponse.<CampaignResponse>builder()
                .content(rows.getContent().stream().map(c -> campaign(c, List.of())).toList())
                .pageNumber(rows.getNumber()).pageSize(rows.getSize()).totalElements(rows.getTotalElements())
                .totalPages(rows.getTotalPages()).isLast(rows.isLast()).build();
    }

    @Override
    @Transactional
    public CodeResponse createCode(Long id, CodeCreateRequest request) {
        if (!campaignRepository.existsById(id)) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy chiến dịch.");
        String code = request.getMaCode() == null ? "" : request.getMaCode().strip().toUpperCase(Locale.ROOT);
        if (code.isBlank() || code.length() > 50) throw new AppException(ErrorCode.INVALID_REQUEST, "Mã phải có từ 1 đến 50 ký tự.");
        if (codeRepository.findByCodeIgnoreCase(code).isPresent()) throw new AppException(ErrorCode.DATA_CONFLICT, "Mã Voucher đã tồn tại.");
        try {
            return code(codeRepository.saveAndFlush(MaGiamGia.builder().campaignId(id).code(code)
                    .issued(request.getSoLuongPhatHanh()).used(0).held(0).status("ACTIVE").deleted(false).build()));
        } catch (DataIntegrityViolationException e) {
            throw new AppException(ErrorCode.DATA_CONFLICT, "Mã Voucher đã tồn tại.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<PublicOfferRes> listPublicOffers() {
        List<PublicOfferRes> offers = new java.util.ArrayList<>();
        for (KhuyenMai campaign : campaignRepository.findPublicActive(LocalDateTime.now())) {
            for (MaGiamGia code : codeRepository.findByCampaignIdOrderByIdAsc(campaign.getId())) {
                if (Boolean.TRUE.equals(code.getDeleted()) || !"ACTIVE".equalsIgnoreCase(code.getStatus())) continue;
                int issued = code.getIssued() == null ? 0 : code.getIssued();
                int used = code.getUsed() == null ? 0 : code.getUsed();
                int held = code.getHeld() == null ? 0 : code.getHeld();
                if (issued <= used + held) continue;
                offers.add(PublicOfferRes.builder()
                        .campaignId(campaign.getId()).title(campaign.getName())
                        .discountType(campaign.getDiscountType()).discountValue(campaign.getDiscountValue())
                        .conditionText(campaign.getConditionText())
                        .startAt(campaign.getStartAt()).endAt(campaign.getEndAt())
                        .code(code.getCode()).build());
                break;
            }
        }
        return offers;
    }

    private CampaignResponse campaign(KhuyenMai c, List<CodeResponse> codes) {
        return CampaignResponse.builder().maKm(c.getId()).tenCtkm(c.getName()).loaiGiam(c.getDiscountType())
                .giaTriGiam(c.getDiscountValue()).ngayBatDau(c.getStartAt()).ngayKetThuc(c.getEndAt())
                .dieuKienApDung(c.getConditionText()).trangThai(c.getStatus()).phienBan(c.getVersion())
                .maSpApDung(c.getProductScope().stream().sorted().toList()).codes(codes).build();
    }

    private CodeResponse code(MaGiamGia c) {
        return CodeResponse.builder().maVoucher(c.getId()).maKm(c.getCampaignId()).maCode(c.getCode())
                .soLuongPhatHanh(c.getIssued()).daSuDung(c.getUsed() == null ? 0 : c.getUsed())
                .soLuongGiuCho(c.getHeld() == null ? 0 : c.getHeld()).trangThai(c.getStatus()).build();
    }

    private List<CodeResponse> codes(Long campaignId) {
        return codeRepository.findByCampaignIdOrderByIdAsc(campaignId).stream().map(this::code).toList();
    }

    private Set<Long> validateScope(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) return Set.of();
        List<Long> existing = productRepository.findAllById(ids).stream().map(p -> p.getId()).toList();
        if (existing.size() != ids.size()) throw new AppException(ErrorCode.INVALID_REQUEST, "Có sản phẩm không tồn tại trong phạm vi chiến dịch.");
        return new HashSet<>(ids);
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static void validateWindow(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null || start.isAfter(end)) throw new AppException(ErrorCode.INVALID_REQUEST, "Khoảng thời gian chiến dịch không hợp lệ.");
    }

    private static String normalizeType(String type) {
        String normalized = type == null ? "" : type.strip().toUpperCase(Locale.ROOT);
        if (!Set.of("PHAN_TRAM", "SO_TIEN", "FREE_SHIP").contains(normalized)) throw new AppException(ErrorCode.INVALID_REQUEST, "Loại giảm giá không được hỗ trợ.");
        return normalized;
    }

    private static void validateValue(String type, BigDecimal value) {
        if (value == null || value.signum() <= 0 || ("PHAN_TRAM".equals(type) && value.compareTo(BigDecimal.valueOf(100)) > 0)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Giá trị giảm giá không hợp lệ.");
        }
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.strip(); }
}
