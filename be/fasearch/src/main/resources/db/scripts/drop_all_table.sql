-- File: src/main/resources/db/script/drop_all_tables.sql

-- Xóa tất cả các bảng (kể cả bảng có khóa ngoại) trong schema public
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Lưu ý: Lệnh CASCADE sẽ xử lý luôn các liên kết khóa ngoại (Foreign Key)