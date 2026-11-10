-- Accent-insensitive search text for the admin lists.
-- Only immutable built-ins are used (lower, translate, regexp_replace, btrim), so the value can be
-- a STORED generated column without any extension or trigger. The character table matches
-- SearchTextNormalizer so a normalised query and the stored text use the same alphabet.
-- No index yet: measure first, add pg_trgm separately if the scan becomes a problem.


-- Product list: product name. Model code, product id and brand/SKU are matched by the query.
ALTER TABLE san_pham ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
    btrim(regexp_replace(lower(translate(coalesce(ten_sp, ''), 'áÁàÀảẢãÃạẠăĂắẮằẰẳẲẵẴặẶâÂấẤầẦẩẨẫẪậẬéÉèÈẻẺẽẼẹẸêÊếẾềỀểỂễỄệỆíÍìÌỉỈĩĨịỊóÓòÒỏỎõÕọỌôÔốỐồỒổỔỗỖộỘơƠớỚờỜởỞỡỠợỢúÚùÙủỦũŨụỤưƯứỨừỪửỬữỮựỰýÝỳỲỷỶỹỸỵỴđĐ', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd')), '\s+', ' ', 'g'))
) STORED;

-- Variant rows: barcode, colour, size and SKU id.
ALTER TABLE bien_the_sp ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
    btrim(regexp_replace(lower(translate(coalesce(ma_vach, '') || ' ' || coalesce(mau_sac, '') || ' ' || coalesce(kich_co, '') || ' ' || ma_sku::text, 'áÁàÀảẢãÃạẠăĂắẮằẰẳẲẵẴặẶâÂấẤầẦẩẨẫẪậẬéÉèÈẻẺẽẼẹẸêÊếẾềỀểỂễỄệỆíÍìÌỉỈĩĨịỊóÓòÒỏỎõÕọỌôÔốỐồỒổỔỗỖộỘơƠớỚờỜởỞỡỠợỢúÚùÙủỦũŨụỤưƯứỨừỪửỬữỮựỰýÝỳỲỷỶỹỸỵỴđĐ', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd')), '\s+', ' ', 'g'))
) STORED;

-- Customer list and order customer column: name and phone. Email lives on tai_khoan.
ALTER TABLE khach_hang ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
    btrim(regexp_replace(lower(translate(coalesce(ho_kh, '') || ' ' || coalesce(ten_kh, '') || ' ' || coalesce(sdt, ''), 'áÁàÀảẢãÃạẠăĂắẮằẰẳẲẵẴặẶâÂấẤầẦẩẨẫẪậẬéÉèÈẻẺẽẼẹẸêÊếẾềỀểỂễỄệỆíÍìÌỉỈĩĨịỊóÓòÒỏỎõÕọỌôÔốỐồỒổỔỗỖộỘơƠớỚờỜởỞỡỠợỢúÚùÙủỦũŨụỤưƯứỨừỪửỬữỮựỰýÝỳỲỷỶỹỸỵỴđĐ', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd')), '\s+', ' ', 'g'))
) STORED;

-- Order list: order code. Customer name and phone come from khach_hang through a join.
ALTER TABLE don_hang ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
    btrim(regexp_replace(lower(translate(coalesce(ma_don, ''), 'áÁàÀảẢãÃạẠăĂắẮằẰẳẲẵẴặẶâÂấẤầẦẩẨẫẪậẬéÉèÈẻẺẽẼẹẸêÊếẾềỀểỂễỄệỆíÍìÌỉỈĩĨịỊóÓòÒỏỎõÕọỌôÔốỐồỒổỔỗỖộỘơƠớỚờỜởỞỡỠợỢúÚùÙủỦũŨụỤưƯứỨừỪửỬữỮựỰýÝỳỲỷỶỹỸỵỴđĐ', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd')), '\s+', ' ', 'g'))
) STORED;

-- Brand filter for the product list: brand name and slug.
ALTER TABLE thuong_hieu ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
    btrim(regexp_replace(lower(translate(coalesce(ten_thuong_hieu, '') || ' ' || coalesce(slug, ''), 'áÁàÀảẢãÃạẠăĂắẮằẰẳẲẵẴặẶâÂấẤầẦẩẨẫẪậẬéÉèÈẻẺẽẼẹẸêÊếẾềỀểỂễỄệỆíÍìÌỉỈĩĨịỊóÓòÒỏỎõÕọỌôÔốỐồỒổỔỗỖộỘơƠớỚờỜởỞỡỠợỢúÚùÙủỦũŨụỤưƯứỨừỪửỬữỮựỰýÝỳỲỷỶỹỸỵỴđĐ', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd')), '\s+', ' ', 'g'))
) STORED;
