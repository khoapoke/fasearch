# Phiếu chấm relevance

## Thông tin chỉ đọc

- Query ID:
- Raw query:
- Intent clarification:
- Intent card version/hash:
- Product version/group:
- Guideline version:

## Khả năng chấm

- [ ] Có đủ thông tin để chấm
- [ ] CANNOT_JUDGE do ảnh hoặc thông tin sản phẩm không đủ

Nếu CANNOT_JUDGE, chọn `INSUFFICIENT_PRODUCT_INFORMATION`, mô tả phần thiếu và không ghi grade 0.

## Grade

- [ ] 3 Highly Relevant
- [ ] 2 Relevant
- [ ] 1 Acceptable Substitute
- [ ] 0 Irrelevant

## Reason codes

- [ ] WRONG_CATEGORY
- [ ] NEGATION_VIOLATION
- [ ] MAJOR_ATTRIBUTE_MISMATCH
- [ ] MULTIPLE_MINOR_MISMATCHES
- [ ] VIBE_ONLY_MATCH
- [ ] OCCASION_MISMATCH
- [ ] INSUFFICIENT_PRODUCT_INFORMATION

## Constraint assessment

Với từng constraint trong intent card, chọn:

- SATISFIED
- VIOLATED
- UNKNOWN

Ghi observed facet value và correction nếu approved product facet sai.

## Ghi chú

Chỉ mô tả bằng chứng nhìn thấy hoặc metadata được phép. Không đoán system nào trả result và không xem grade của assessor khác.

## Metadata hệ thống

- Assessor pseudonym:
- Timestamp:
- Form version:
- Supersedes judgment ID nếu là correction:
- Correction reason:
