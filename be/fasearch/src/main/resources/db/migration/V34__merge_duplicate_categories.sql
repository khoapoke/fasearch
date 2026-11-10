-- Rank by live product count; preserve all product and draft references, including deleted products.
CREATE TEMP TABLE category_merge_map ON COMMIT DROP AS
WITH ranked AS (
    SELECT d.ma_danh_muc,
           first_value(d.ma_danh_muc) OVER (
               PARTITION BY lower(btrim(regexp_replace(d.ten_danh_muc, '\s+', ' ', 'g')))
               ORDER BY count(s.ma_sp) FILTER (WHERE s.da_xoa = false) DESC, d.ma_danh_muc
           ) AS canonical_id,
           count(*) OVER (PARTITION BY lower(btrim(regexp_replace(d.ten_danh_muc, '\s+', ' ', 'g')))) AS group_size
    FROM danh_muc d LEFT JOIN san_pham s ON s.ma_danh_muc = d.ma_danh_muc
    WHERE d.da_xoa = false
    GROUP BY d.ma_danh_muc, d.ten_danh_muc
)
SELECT ma_danh_muc, canonical_id FROM ranked WHERE group_size > 1;

UPDATE san_pham p SET ma_danh_muc = m.canonical_id
FROM category_merge_map m WHERE p.ma_danh_muc = m.ma_danh_muc AND m.ma_danh_muc <> m.canonical_id;
UPDATE product_draft p SET ma_danh_muc = m.canonical_id
FROM category_merge_map m WHERE p.ma_danh_muc = m.ma_danh_muc AND m.ma_danh_muc <> m.canonical_id;
UPDATE danh_muc d SET da_xoa = true, ngay_xoa = now(), nguoi_xoa = NULL,
    ly_do_xoa = 'Gộp trùng tên vào #' || m.canonical_id
FROM category_merge_map m WHERE d.ma_danh_muc = m.ma_danh_muc AND m.ma_danh_muc <> m.canonical_id;
UPDATE danh_muc d SET ten_danh_muc = upper(left(btrim(d.ten_danh_muc), 1)) || lower(substr(btrim(d.ten_danh_muc), 2))
WHERE d.ma_danh_muc IN (SELECT canonical_id FROM category_merge_map)
  AND d.ten_danh_muc = upper(d.ten_danh_muc) AND d.ten_danh_muc <> lower(d.ten_danh_muc);

CREATE UNIQUE INDEX IF NOT EXISTS uq_danh_muc_active_name ON danh_muc (lower(btrim(ten_danh_muc))) WHERE da_xoa = false;
DROP TABLE category_merge_map;
