"""Bộ kịch bản benchmark tìm kiếm thời trang chuẩn hóa song ngữ (Fasearch AI).

- target_article_type: Nhãn chuẩn xác 100% khớp với cột articleType trong styles.csv.
- query: Câu truy vấn tiếng Anh tối ưu hóa cho không gian vector CLIP.
- description: Mô tả mục đích kiểm thử bằng tiếng Việt.
"""

from typing import Dict, List, Literal


# Bộ kịch bản toàn diện gồm đầy đủ 143 loại articleType trong styles.csv
FULL_SEARCH_BENCHMARK_CASES: List[Dict[str, str]] = [
    {
        "query": "fashion accessory gift set for men women",
        "target_article_type": "Accessory Gift Set",
        "description": "Tìm kiếm bộ quà tặng phụ kiện thời trang"
    },
    {
        "query": "sexy babydoll nightwear lingerie",
        "target_article_type": "Baby Dolls",
        "description": "Tìm kiếm đầm ngủ babydoll quyến rũ"
    },
    {
        "query": "travel laptop school backpack bag",
        "target_article_type": "Backpacks",
        "description": "Tìm kiếm balo du lịch đi học đựng laptop"
    },
    {
        "query": "traditional metallic bridal bangle set",
        "target_article_type": "Bangle",
        "description": "Tìm kiếm vòng tay lắc tay trang sức nữ"
    },
    {
        "query": "outdoor indoor leather sports basketball",
        "target_article_type": "Basketballs",
        "description": "Tìm kiếm quả bóng rổ thể thao"
    },
    {
        "query": "soft cotton bathroom dressing bath robe",
        "target_article_type": "Bath Robe",
        "description": "Tìm kiếm áo choàng tắm cotton mềm mại"
    },
    {
        "query": "makeup beauty tool brush accessory",
        "target_article_type": "Beauty Accessory",
        "description": "Tìm kiếm phụ kiện dụng cụ trang điểm làm đẹp"
    },
    {
        "query": "classic genuine leather waist belt",
        "target_article_type": "Belts",
        "description": "Tìm kiếm thắt lưng dây nịt da nam nữ"
    },
    {
        "query": "formal slim fit suit blazer jacket",
        "target_article_type": "Blazers",
        "description": "Tìm kiếm áo khoác vest blazer công sở"
    },
    {
        "query": "moisturizing nourishing body skin lotion",
        "target_article_type": "Body Lotion",
        "description": "Tìm kiếm sữa dưỡng thể chăm sóc da"
    },
    {
        "query": "refreshing exfoliating body wash scrub",
        "target_article_type": "Body Wash and Scrub",
        "description": "Tìm kiếm sữa tắm tẩy tế bào chết cơ thể"
    },
    {
        "query": "infant baby knitted soft shoes booties",
        "target_article_type": "Booties",
        "description": "Tìm kiếm giày len mềm cho em bé sơ sinh"
    },
    {
        "query": "men cotton loose boxer shorts underwear",
        "target_article_type": "Boxers",
        "description": "Tìm kiếm quần lót đùi nam boxer cotton"
    },
    {
        "query": "women wireless comfortable push up bra",
        "target_article_type": "Bra",
        "description": "Tìm kiếm áo lót ngực nữ nâng ngực thoải mái"
    },
    {
        "query": "fashion chain charm bracelet jewelry",
        "target_article_type": "Bracelet",
        "description": "Tìm kiếm vòng đeo tay chuỗi hạt trang sức"
    },
    {
        "query": "men soft cotton underwear briefs",
        "target_article_type": "Briefs",
        "description": "Tìm kiếm quần lót tam giác nam cotton"
    },
    {
        "query": "women sleeveless cotton inner camisole slip",
        "target_article_type": "Camisoles",
        "description": "Tìm kiếm áo hai dây lót trong camisole nữ"
    },
    {
        "query": "women casual 3 4 length cropped capris pants",
        "target_article_type": "Capris",
        "description": "Tìm kiếm quần lửng capri nữ ống lỡ"
    },
    {
        "query": "sports baseball outdoor sun visor cap",
        "target_article_type": "Caps",
        "description": "Tìm kiếm mũ lưỡi trai thể thao chống nắng"
    },
    {
        "query": "casual daily walking sneakers shoes",
        "target_article_type": "Casual Shoes",
        "description": "Tìm kiếm giày thể thao dạo phố thường ngày"
    },
    {
        "query": "traditional ethnic cotton churidar leggings",
        "target_article_type": "Churidar",
        "description": "Tìm kiếm quần truyền thống Churidar"
    },
    {
        "query": "matching kids summer clothing outfit set",
        "target_article_type": "Clothing Set",
        "description": "Tìm kiếm bộ quần áo thời trang đồng bộ"
    },
    {
        "query": "women evening party clutch purse handbag",
        "target_article_type": "Clutches",
        "description": "Tìm kiếm ví cầm tay dự tiệc clutch nữ"
    },
    {
        "query": "pressed powder compact makeup foundation",
        "target_article_type": "Compact",
        "description": "Tìm kiếm phấn phủ dạng nén trang điểm"
    },
    {
        "query": "liquid blemish coverage skin concealer makeup",
        "target_article_type": "Concealer",
        "description": "Tìm kiếm kem che khuyết điểm trang điểm"
    },
    {
        "query": "classic metallic formal shirt cufflinks",
        "target_article_type": "Cufflinks",
        "description": "Tìm kiếm khuy măng sét cài cổ tay áo sơ mi"
    },
    {
        "query": "decorative home sofa cushion pillow covers",
        "target_article_type": "Cushion Covers",
        "description": "Tìm kiếm vỏ bọc gối tựa lưng trang trí sofa"
    },
    {
        "query": "fresh antiperspirant body deodorant spray",
        "target_article_type": "Deodorant",
        "description": "Tìm kiếm chai lăn xịt khử mùi toàn thân"
    },
    {
        "query": "elegant evening party cocktail dress",
        "target_article_type": "Dresses",
        "description": "Tìm kiếm váy đầm dạ hội thời trang nữ"
    },
    {
        "query": "gym travel sports duffel barrel bag",
        "target_article_type": "Duffel Bag",
        "description": "Tìm kiếm túi trống du lịch thể thao tập gym"
    },
    {
        "query": "traditional lightweight ethnic silk dupatta scarf",
        "target_article_type": "Dupatta",
        "description": "Tìm kiếm khăn choàng truyền thống Dupatta"
    },
    {
        "query": "golden dangle drop hoop earrings jewelry",
        "target_article_type": "Earrings",
        "description": "Tìm kiếm khuyên tai bông tai nữ trang"
    },
    {
        "query": "anti aging dark circles under eye cream",
        "target_article_type": "Eye Cream",
        "description": "Tìm kiếm kem dưỡng ẩm xóa quầng thâm mắt"
    },
    {
        "query": "colorful eyeshadow makeup palette kit",
        "target_article_type": "Eyeshadow",
        "description": "Tìm kiếm bảng phấn mắt trang điểm nhiều màu"
    },
    {
        "query": "hydrating daily face cream moisturiser",
        "target_article_type": "Face Moisturisers",
        "description": "Tìm kiếm kem dưỡng ẩm da mặt hàng ngày"
    },
    {
        "query": "deep cleansing facial exfoliating scrub wash",
        "target_article_type": "Face Scrub and Exfoliator",
        "description": "Tìm kiếm kem tẩy tế bào chết làm sạch sâu da mặt"
    },
    {
        "query": "brightening skin care face serum gel",
        "target_article_type": "Face Serum and Gel",
        "description": "Tìm kiếm tinh chất serum dưỡng trắng da mặt"
    },
    {
        "query": "daily gentle foaming facial wash cleanser",
        "target_article_type": "Face Wash and Cleanser",
        "description": "Tìm kiếm sữa rửa mặt tạo bọt dịu nhẹ"
    },
    {
        "query": "women comfortable flat ballerina shoes",
        "target_article_type": "Flats",
        "description": "Tìm kiếm giày búp bê nữ đế bệt êm ái"
    },
    {
        "query": "beach summer rubber thongs flip flops",
        "target_article_type": "Flip Flops",
        "description": "Tìm kiếm dép tông xỏ ngón đi biển"
    },
    {
        "query": "sports training soccer match football ball",
        "target_article_type": "Footballs",
        "description": "Tìm kiếm quả bóng đá thể thao thi đấu"
    },
    {
        "query": "classic men leather oxford formal dress shoes",
        "target_article_type": "Formal Shoes",
        "description": "Tìm kiếm giày tây nam công sở da bóng lịch sự"
    },
    {
        "query": "liquid face skin foundation primer makeup",
        "target_article_type": "Foundation and Primer",
        "description": "Tìm kiếm kem nền trang điểm che khuyết điểm"
    },
    {
        "query": "luxury perfume cologne fragrance gift set",
        "target_article_type": "Fragrance Gift Set",
        "description": "Tìm kiếm bộ quà tặng nước hoa sang trọng"
    },
    {
        "query": "promotional complimentary gift item merchandise",
        "target_article_type": "Free Gifts",
        "description": "Tìm kiếm quà tặng kèm khuyến mãi"
    },
    {
        "query": "warm winter knitted leather hand gloves",
        "target_article_type": "Gloves",
        "description": "Tìm kiếm găng tay giữ ấm mùa đông"
    },
    {
        "query": "stylish hair clip band pin accessory",
        "target_article_type": "Hair Accessory",
        "description": "Tìm kiếm kẹp tóc phụ kiện cài tóc nữ"
    },
    {
        "query": "permanent salon hair colour dye cream",
        "target_article_type": "Hair Colour",
        "description": "Tìm kiếm thuốc nhuộm tóc thời trang"
    },
    {
        "query": "women luxury leather shoulder handbag purse",
        "target_article_type": "Handbags",
        "description": "Tìm kiếm túi xách tay nữ da cao cấp"
    },
    {
        "query": "outdoor wide brim summer sun beach hat",
        "target_article_type": "Hat",
        "description": "Tìm kiếm nón mũ rộng vành che nắng"
    },
    {
        "query": "elastic hair sport workout headband",
        "target_article_type": "Headband",
        "description": "Tìm kiếm băng đô cài tóc thể thao co giãn"
    },
    {
        "query": "elegant pointed toe high heels dress pumps",
        "target_article_type": "Heels",
        "description": "Tìm kiếm giày cao gót nữ mũi nhọn sang trọng"
    },
    {
        "query": "radiant cheek blush shimmer highlighter makeup",
        "target_article_type": "Highlighter and Blush",
        "description": "Tìm kiếm phấn má hồng bắt sáng trang điểm"
    },
    {
        "query": "men cotton sleeveless gym undershirt vest",
        "target_article_type": "Innerwear Vests",
        "description": "Tìm kiếm áo ba lỗ lót trong nam cotton"
    },
    {
        "query": "digital tablet ipad protective case cover",
        "target_article_type": "Ipad",
        "description": "Tìm kiếm bao da ốp lưng bảo vệ máy tính bảng iPad"
    },
    {
        "query": "warm casual winter zipper jacket coat",
        "target_article_type": "Jackets",
        "description": "Tìm kiếm áo khoác gió mùa đông có khóa kéo"
    },
    {
        "query": "slim fit blue denim jeans pants",
        "target_article_type": "Jeans",
        "description": "Tìm kiếm quần jean bò xanh ống đứng"
    },
    {
        "query": "women stretch denim skinny jeggings leggings",
        "target_article_type": "Jeggings",
        "description": "Tìm kiếm quần legging giả bò co giãn nữ"
    },
    {
        "query": "bridal necklace and earrings jewellery set",
        "target_article_type": "Jewellery Set",
        "description": "Tìm kiếm bộ trang sức vòng cổ bông tai cô dâu"
    },
    {
        "query": "women fashionable one piece casual jumpsuit",
        "target_article_type": "Jumpsuit",
        "description": "Tìm kiếm bộ đồ liền thân jumpsuit thời trang nữ"
    },
    {
        "query": "waterproof black kajal eyeliner pencil",
        "target_article_type": "Kajal and Eyeliner",
        "description": "Tìm kiếm bút kẻ mắt nước viền mắt màu đen"
    },
    {
        "query": "metallic car key chain ring holder",
        "target_article_type": "Key chain",
        "description": "Tìm kiếm móc khóa treo chìa khóa kim loại"
    },
    {
        "query": "traditional ethnic kurta with trousers pant set",
        "target_article_type": "Kurta Sets",
        "description": "Tìm kiếm bộ trang phục áo và quần Kurta truyền thống"
    },
    {
        "query": "men women ethnic cotton kurta tunic",
        "target_article_type": "Kurtas",
        "description": "Tìm kiếm áo truyền thống Kurta dáng dài"
    },
    {
        "query": "women stylish short ethnic kurti top",
        "target_article_type": "Kurtis",
        "description": "Tìm kiếm áo kiểu ngắn Kurti thời trang nữ"
    },
    {
        "query": "padded waterproof business laptop messenger bag",
        "target_article_type": "Laptop Bag",
        "description": "Tìm kiếm cặp túi chống sốc đựng máy tính laptop"
    },
    {
        "query": "women elastic soft stretch cotton leggings",
        "target_article_type": "Leggings",
        "description": "Tìm kiếm quần ôm legging co giãn thoải mái"
    },
    {
        "query": "traditional wedding bridal lehenga choli dress",
        "target_article_type": "Lehenga Choli",
        "description": "Tìm kiếm trang phục cưới truyền thống Lehenga Choli"
    },
    {
        "query": "moisturizing lip care balm chapstick",
        "target_article_type": "Lip Care",
        "description": "Tìm kiếm son dưỡng ẩm chống nứt nẻ môi"
    },
    {
        "query": "shiny glossy hydrating plumping lip gloss",
        "target_article_type": "Lip Gloss",
        "description": "Tìm kiếm son bóng dưỡng môi căng mọng"
    },
    {
        "query": "defining matte velvet lip liner pencil",
        "target_article_type": "Lip Liner",
        "description": "Tìm kiếm chì kẻ viền môi định hình môi"
    },
    {
        "query": "volumizing clear plumping shiny lip gloss",
        "target_article_type": "Lip Plumper",
        "description": "Tìm kiếm son làm đầy môi căng bóng"
    },
    {
        "query": "matte velvet long lasting red lipstick",
        "target_article_type": "Lipstick",
        "description": "Tìm kiếm thỏi son môi lì màu đỏ thời thượng"
    },
    {
        "query": "casual loose cotton home sleep lounge pants",
        "target_article_type": "Lounge Pants",
        "description": "Tìm kiếm quần mặc ở nhà ống rộng thoải mái"
    },
    {
        "query": "comfortable home nightwear sleep lounge shorts",
        "target_article_type": "Lounge Shorts",
        "description": "Tìm kiếm quần đùi mặc ở nhà thoáng mát"
    },
    {
        "query": "soft comfortable home sleep lounge t-shirt",
        "target_article_type": "Lounge Tshirts",
        "description": "Tìm kiếm áo thun mặc ở nhà cotton mềm"
    },
    {
        "query": "cleansing micellar makeup remover water",
        "target_article_type": "Makeup Remover",
        "description": "Tìm kiếm nước tẩy trang làm sạch lớp trang điểm"
    },
    {
        "query": "waterproof volume lengthening black eyelash mascara",
        "target_article_type": "Mascara",
        "description": "Tìm kiếm chuốt mi mascara làm cong và dày mi"
    },
    {
        "query": "purifying facial sheet mask peel off",
        "target_article_type": "Mask and Peel",
        "description": "Tìm kiếm mặt nạ lột làm sạch và dưỡng da"
    },
    {
        "query": "men beard shaving grooming care kit",
        "target_article_type": "Mens Grooming Kit",
        "description": "Tìm kiếm bộ dụng cụ chăm sóc cạo râu cho nam"
    },
    {
        "query": "casual shoulder crossbody canvas messenger bag",
        "target_article_type": "Messenger Bag",
        "description": "Tìm kiếm túi đeo chéo đưa thư quai chéo"
    },
    {
        "query": "portable smartphone mobile protective pouch pouch",
        "target_article_type": "Mobile Pouch",
        "description": "Tìm kiếm bao da túi đựng điện thoại nhỏ gọn"
    },
    {
        "query": "warm winter knitted neck muffler scarf",
        "target_article_type": "Mufflers",
        "description": "Tìm kiếm khăn len ống quàng cổ giữ ấm"
    },
    {
        "query": "nail care clipper file manicure essentials tool",
        "target_article_type": "Nail Essentials",
        "description": "Tìm kiếm bộ dụng cụ làm móng chăm sóc móng tay"
    },
    {
        "query": "glossy colorful nail polish lacquer varnish",
        "target_article_type": "Nail Polish",
        "description": "Tìm kiếm sơn móng tay bóng nhiều màu sắc"
    },
    {
        "query": "fashion golden pendant chain necklace jewelry",
        "target_article_type": "Necklace and Chains",
        "description": "Tìm kiếm dây chuyền vòng cổ vàng trang sức"
    },
    {
        "query": "men traditional sleeveless ethnic nehru jacket",
        "target_article_type": "Nehru Jackets",
        "description": "Tìm kiếm áo gile cổ tàu Nehru truyền thống"
    },
    {
        "query": "comfortable cotton matching pajama night suit set",
        "target_article_type": "Night suits",
        "description": "Tìm kiếm bộ đồ ngủ pijama cotton thoáng mát"
    },
    {
        "query": "women soft silk sleeping nightdress gown",
        "target_article_type": "Nightdress",
        "description": "Tìm kiếm váy ngủ đầm ngủ lụa quyến rũ"
    },
    {
        "query": "traditional pleated ethnic patiala salwar pants",
        "target_article_type": "Patiala",
        "description": "Tìm kiếm quần ống thụng xếp ly Patiala"
    },
    {
        "query": "sparkling crystal gem pendant locket charm",
        "target_article_type": "Pendant",
        "description": "Tìm kiếm mặt dây chuyền đính đá pha lê"
    },
    {
        "query": "luxury fragrance perfume body mist spray",
        "target_article_type": "Perfume and Body Mist",
        "description": "Tìm kiếm nước hoa xịt thơm cơ thể quyến rũ"
    },
    {
        "query": "waterproof hooded outdoor rain jacket windbreaker",
        "target_article_type": "Rain Jacket",
        "description": "Tìm kiếm áo khoác chống nước đi mưa có mũ"
    },
    {
        "query": "waterproof outdoor rain trousers overpants",
        "target_article_type": "Rain Trousers",
        "description": "Tìm kiếm quần dài chống nước mặc đi mưa"
    },
    {
        "query": "elegant sparkling wedding engagement gold finger ring",
        "target_article_type": "Ring",
        "description": "Tìm kiếm nhẫn cưới đính đá trang sức sang trọng"
    },
    {
        "query": "soft comfortable night bath dressing gown robe",
        "target_article_type": "Robe",
        "description": "Tìm kiếm áo choàng ngủ mềm mại thư giãn"
    },
    {
        "query": "casual summer one piece shorts romper playsuit",
        "target_article_type": "Rompers",
        "description": "Tìm kiếm bộ áo liền quần soóc ngắn romper"
    },
    {
        "query": "outdoor hiking camping large travel rucksack backpack",
        "target_article_type": "Rucksacks",
        "description": "Tìm kiếm balo du lịch dã ngoại trekking cỡ lớn"
    },
    {
        "query": "traditional ethnic loose cotton salwar pants",
        "target_article_type": "Salwar",
        "description": "Tìm kiếm quần dài truyền thống Salwar"
    },
    {
        "query": "traditional salwar pants matching dupatta scarf set",
        "target_article_type": "Salwar and Dupatta",
        "description": "Tìm kiếm bộ quần Salwar kèm khăn choàng Dupatta"
    },
    {
        "query": "casual summer outdoor open toe strappy sandals",
        "target_article_type": "Sandals",
        "description": "Tìm kiếm dép quai hậu xăng đan dạo phố"
    },
    {
        "query": "traditional Indian silk embroidered festive saree",
        "target_article_type": "Sarees",
        "description": "Tìm kiếm trang phục truyền thống Saree Ấn Độ"
    },
    {
        "query": "lightweight fashion printed neck silk scarves",
        "target_article_type": "Scarves",
        "description": "Tìm kiếm khăn quàng cổ lụa họa tiết thời trang"
    },
    {
        "query": "women high waist tummy control body shapewear",
        "target_article_type": "Shapewear",
        "description": "Tìm kiếm quần gen định hình vóc dáng thon gọn"
    },
    {
        "query": "formal long sleeve button down dress shirt",
        "target_article_type": "Shirts",
        "description": "Tìm kiếm áo sơ mi dài tay công sở lịch lãm"
    },
    {
        "query": "shoe care brush polish insole accessories",
        "target_article_type": "Shoe Accessories",
        "description": "Tìm kiếm phụ kiện xi lót giày và cọ đánh giày"
    },
    {
        "query": "durable replacement sneaker athletic shoe laces",
        "target_article_type": "Shoe Laces",
        "description": "Tìm kiếm dây giày thể thao sneaker bền đẹp"
    },
    {
        "query": "casual summer breathable cotton shorts",
        "target_article_type": "Shorts",
        "description": "Tìm kiếm quần soóc đùi ngắn thoáng mát mùa hè"
    },
    {
        "query": "women lightweight open front knitted crop shrug cardigan",
        "target_article_type": "Shrug",
        "description": "Tìm kiếm áo khoác lửng dáng ngắn nhẹ nhàng"
    },
    {
        "query": "fashionable high waist pleated flared skirt",
        "target_article_type": "Skirts",
        "description": "Tìm kiếm chân váy xếp ly xòe thời trang nữ"
    },
    {
        "query": "soft breathable cotton ankle crew socks",
        "target_article_type": "Socks",
        "description": "Tìm kiếm tất vớ cotton cổ ngắn êm ái"
    },
    {
        "query": "rugged outdoor hiking athletic sports sandals",
        "target_article_type": "Sports Sandals",
        "description": "Tìm kiếm dép sandal thể thao dã ngoại quai dán"
    },
    {
        "query": "athletic lightweight running sports gym shoes",
        "target_article_type": "Sports Shoes",
        "description": "Tìm kiếm giày thể thao chạy bộ tập gym"
    },
    {
        "query": "women sheer sheer elastic nylon tights stockings",
        "target_article_type": "Stockings",
        "description": "Tìm kiếm tất da chân dài quần tất nữ mỏng"
    },
    {
        "query": "fashion wool winter wrap neck stoles scarf",
        "target_article_type": "Stoles",
        "description": "Tìm kiếm khăn choàng vai giữ ấm mùa đông"
    },
    {
        "query": "men formal two piece business wedding dress suit",
        "target_article_type": "Suits",
        "description": "Tìm kiếm bộ veston âu phục nam sang trọng"
    },
    {
        "query": "polarized stylish uv protection dark sunglasses",
        "target_article_type": "Sunglasses",
        "description": "Tìm kiếm kính mát thời trang chống tia UV"
    },
    {
        "query": "spf broad spectrum daily skin sunscreen lotion",
        "target_article_type": "Sunscreen",
        "description": "Tìm kiếm kem chống nắng bảo vệ da"
    },
    {
        "query": "adjustable elastic formal trouser pants suspenders",
        "target_article_type": "Suspenders",
        "description": "Tìm kiếm dây đai chữ Y kẹp quần âu suspenders"
    },
    {
        "query": "warm winter knitted pullover wool sweater",
        "target_article_type": "Sweaters",
        "description": "Tìm kiếm áo len dệt kim cổ chui mùa đông"
    },
    {
        "query": "casual hooded fleece long sleeve sweatshirt hoodie",
        "target_article_type": "Sweatshirts",
        "description": "Tìm kiếm áo nỉ dài tay chui đầu năng động"
    },
    {
        "query": "women summer beach bathing suit swimwear bikini",
        "target_article_type": "Swimwear",
        "description": "Tìm kiếm đồ bơi áo tắm bikini đi biển"
    },
    {
        "query": "padded zipper protective tablet sleeve case",
        "target_article_type": "Tablet Sleeve",
        "description": "Tìm kiếm túi chống sốc bảo vệ máy tính bảng"
    },
    {
        "query": "classic formal woven silk necktie tie",
        "target_article_type": "Ties",
        "description": "Tìm kiếm cà vạt lụa thắt cổ áo sơ mi"
    },
    {
        "query": "matching formal silk necktie and metal cufflinks set",
        "target_article_type": "Ties and Cufflinks",
        "description": "Tìm kiếm bộ cà vạt và khuy cài măng sét đồng bộ"
    },
    {
        "query": "opaque elastic workout running sports tights leggings",
        "target_article_type": "Tights",
        "description": "Tìm kiếm quần tất dày ôm sát chân thể thao"
    },
    {
        "query": "hydrating pore refining facial skin toner",
        "target_article_type": "Toner",
        "description": "Tìm kiếm nước hoa hồng toner cân bằng độ ẩm da"
    },
    {
        "query": "women stylish casual sleeveless summer crop top",
        "target_article_type": "Tops",
        "description": "Tìm kiếm áo kiểu nữ thời trang mặc mùa hè"
    },
    {
        "query": "athletic training workout gym track pants sweatpants",
        "target_article_type": "Track Pants",
        "description": "Tìm kiếm quần nỉ thể thao bo gấu tập gym"
    },
    {
        "query": "men full zipper athletic training tracksuit jacket set",
        "target_article_type": "Tracksuits",
        "description": "Tìm kiếm bộ quần áo thể thao gió tracksuit"
    },
    {
        "query": "portable travel luggage tag passport accessory holder",
        "target_article_type": "Travel Accessory",
        "description": "Tìm kiếm phụ kiện thẻ hành lý ví hộ chiếu du lịch"
    },
    {
        "query": "rolling luggage suitcase wheeled trolley travel bag",
        "target_article_type": "Trolley Bag",
        "description": "Tìm kiếm vali kéo du lịch có bánh xe tiện lợi"
    },
    {
        "query": "men formal slim fit business office dress trousers",
        "target_article_type": "Trousers",
        "description": "Tìm kiếm quần âu tây nam công sở đứng dáng"
    },
    {
        "query": "men comfortable cotton stretch underwear trunk shorts",
        "target_article_type": "Trunk",
        "description": "Tìm kiếm quần lót dạng đùi trunk co giãn nam"
    },
    {
        "query": "casual round neck short sleeve cotton t-shirt",
        "target_article_type": "Tshirts",
        "description": "Tìm kiếm áo thun phông cổ tròn tay ngắn"
    },
    {
        "query": "women bohemian loose flowy casual tunic top",
        "target_article_type": "Tunics",
        "description": "Tìm kiếm áo dáng dài phom rộng phóng khoáng"
    },
    {
        "query": "compact portable automatic folding rain umbrella",
        "target_article_type": "Umbrellas",
        "description": "Tìm kiếm ô dù gập tự động che mưa che nắng"
    },
    {
        "query": "travel outdoor zipper fanny pack waist pouch bag",
        "target_article_type": "Waist Pouch",
        "description": "Tìm kiếm túi bao tử đeo hông đeo bụng tiện lợi"
    },
    {
        "query": "classic formal suit sleeveless dress waistcoat vest",
        "target_article_type": "Waistcoat",
        "description": "Tìm kiếm áo gile vest mặc trong âu phục"
    },
    {
        "query": "classic genuine leather bifold money pocket wallet",
        "target_article_type": "Wallets",
        "description": "Tìm kiếm ví bóp da đựng tiền bỏ túi nam"
    },
    {
        "query": "luxury analog metallic steel wrist watch",
        "target_article_type": "Watches",
        "description": "Tìm kiếm đồng hồ đeo tay kim loại sang trọng"
    },
    {
        "query": "insulated stainless steel portable gym water bottle",
        "target_article_type": "Water Bottle",
        "description": "Tìm kiếm bình giữ nhiệt uống nước thể thao"
    },
    {
        "query": "elastic sweat absorbent sports wristband band",
        "target_article_type": "Wristbands",
        "description": "Tìm kiếm băng đeo cổ tay thể thao thấm mồ hôi"
    }
]


# Bộ kịch bản trọng tâm gồm 36 nhóm ngành hàng thời trang chủ đạo nhất (>96% dữ liệu)
CORE_SEARCH_BENCHMARK_CASES: List[Dict[str, str]] = [
    {
        "query": "travel laptop school backpack bag",
        "target_article_type": "Backpacks",
        "description": "Tìm kiếm balo du lịch đi học đựng laptop"
    },
    {
        "query": "classic genuine leather waist belt",
        "target_article_type": "Belts",
        "description": "Tìm kiếm thắt lưng dây nịt da nam nữ"
    },
    {
        "query": "women wireless comfortable push up bra",
        "target_article_type": "Bra",
        "description": "Tìm kiếm áo lót ngực nữ nâng ngực thoải mái"
    },
    {
        "query": "men soft cotton underwear briefs",
        "target_article_type": "Briefs",
        "description": "Tìm kiếm quần lót tam giác nam cotton"
    },
    {
        "query": "sports baseball outdoor sun visor cap",
        "target_article_type": "Caps",
        "description": "Tìm kiếm mũ lưỡi trai thể thao chống nắng"
    },
    {
        "query": "casual daily walking sneakers shoes",
        "target_article_type": "Casual Shoes",
        "description": "Tìm kiếm giày thể thao dạo phố thường ngày"
    },
    {
        "query": "women evening party clutch purse handbag",
        "target_article_type": "Clutches",
        "description": "Tìm kiếm ví cầm tay dự tiệc clutch nữ"
    },
    {
        "query": "fresh antiperspirant body deodorant spray",
        "target_article_type": "Deodorant",
        "description": "Tìm kiếm chai lăn xịt khử mùi toàn thân"
    },
    {
        "query": "elegant evening party cocktail dress",
        "target_article_type": "Dresses",
        "description": "Tìm kiếm váy đầm dạ hội thời trang nữ"
    },
    {
        "query": "golden dangle drop hoop earrings jewelry",
        "target_article_type": "Earrings",
        "description": "Tìm kiếm khuyên tai bông tai nữ trang"
    },
    {
        "query": "women comfortable flat ballerina shoes",
        "target_article_type": "Flats",
        "description": "Tìm kiếm giày búp bê nữ đế bệt êm ái"
    },
    {
        "query": "beach summer rubber thongs flip flops",
        "target_article_type": "Flip Flops",
        "description": "Tìm kiếm dép tông xỏ ngón đi biển"
    },
    {
        "query": "classic men leather oxford formal dress shoes",
        "target_article_type": "Formal Shoes",
        "description": "Tìm kiếm giày tây nam công sở da bóng lịch sự"
    },
    {
        "query": "women luxury leather shoulder handbag purse",
        "target_article_type": "Handbags",
        "description": "Tìm kiếm túi xách tay nữ da cao cấp"
    },
    {
        "query": "elegant pointed toe high heels dress pumps",
        "target_article_type": "Heels",
        "description": "Tìm kiếm giày cao gót nữ mũi nhọn sang trọng"
    },
    {
        "query": "warm casual winter zipper jacket coat",
        "target_article_type": "Jackets",
        "description": "Tìm kiếm áo khoác gió mùa đông có khóa kéo"
    },
    {
        "query": "slim fit blue denim jeans pants",
        "target_article_type": "Jeans",
        "description": "Tìm kiếm quần jean bò xanh ống đứng"
    },
    {
        "query": "men women ethnic cotton kurta tunic",
        "target_article_type": "Kurtas",
        "description": "Tìm kiếm áo truyền thống Kurta dáng dài"
    },
    {
        "query": "matte velvet long lasting red lipstick",
        "target_article_type": "Lipstick",
        "description": "Tìm kiếm thỏi son môi lì màu đỏ thời thượng"
    },
    {
        "query": "glossy colorful nail polish lacquer varnish",
        "target_article_type": "Nail Polish",
        "description": "Tìm kiếm sơn móng tay bóng nhiều màu sắc"
    },
    {
        "query": "luxury fragrance perfume body mist spray",
        "target_article_type": "Perfume and Body Mist",
        "description": "Tìm kiếm nước hoa xịt thơm cơ thể quyến rũ"
    },
    {
        "query": "casual summer outdoor open toe strappy sandals",
        "target_article_type": "Sandals",
        "description": "Tìm kiếm dép quai hậu xăng đan dạo phố"
    },
    {
        "query": "traditional Indian silk embroidered festive saree",
        "target_article_type": "Sarees",
        "description": "Tìm kiếm trang phục truyền thống Saree Ấn Độ"
    },
    {
        "query": "formal long sleeve button down dress shirt",
        "target_article_type": "Shirts",
        "description": "Tìm kiếm áo sơ mi dài tay công sở lịch lãm"
    },
    {
        "query": "casual summer breathable cotton shorts",
        "target_article_type": "Shorts",
        "description": "Tìm kiếm quần soóc đùi ngắn thoáng mát mùa hè"
    },
    {
        "query": "soft breathable cotton ankle crew socks",
        "target_article_type": "Socks",
        "description": "Tìm kiếm tất vớ cotton cổ ngắn êm ái"
    },
    {
        "query": "athletic lightweight running sports gym shoes",
        "target_article_type": "Sports Shoes",
        "description": "Tìm kiếm giày thể thao chạy bộ tập gym"
    },
    {
        "query": "polarized stylish uv protection dark sunglasses",
        "target_article_type": "Sunglasses",
        "description": "Tìm kiếm kính mát thời trang chống tia UV"
    },
    {
        "query": "warm winter knitted pullover wool sweater",
        "target_article_type": "Sweaters",
        "description": "Tìm kiếm áo len dệt kim cổ chui mùa đông"
    },
    {
        "query": "casual hooded fleece long sleeve sweatshirt hoodie",
        "target_article_type": "Sweatshirts",
        "description": "Tìm kiếm áo nỉ dài tay chui đầu năng động"
    },
    {
        "query": "women stylish casual sleeveless summer crop top",
        "target_article_type": "Tops",
        "description": "Tìm kiếm áo kiểu nữ thời trang mặc mùa hè"
    },
    {
        "query": "athletic training workout gym track pants sweatpants",
        "target_article_type": "Track Pants",
        "description": "Tìm kiếm quần nỉ thể thao bo gấu tập gym"
    },
    {
        "query": "men formal slim fit business office dress trousers",
        "target_article_type": "Trousers",
        "description": "Tìm kiếm quần âu tây nam công sở đứng dáng"
    },
    {
        "query": "casual round neck short sleeve cotton t-shirt",
        "target_article_type": "Tshirts",
        "description": "Tìm kiếm áo thun phông cổ tròn tay ngắn"
    },
    {
        "query": "classic genuine leather bifold money pocket wallet",
        "target_article_type": "Wallets",
        "description": "Tìm kiếm ví bóp da đựng tiền bỏ túi nam"
    },
    {
        "query": "luxury analog metallic steel wrist watch",
        "target_article_type": "Watches",
        "description": "Tìm kiếm đồng hồ đeo tay kim loại sang trọng"
    }
]


# Mặc định sử dụng bộ trọng tâm để kiểm thử nhanh
DEFAULT_BENCHMARK_CASES = CORE_SEARCH_BENCHMARK_CASES


def get_benchmark_cases(mode: Literal["core", "full"] = "core") -> List[Dict[str, str]]:
    """Lấy danh sách kịch bản kiểm thử theo chế độ:
    - "core": 36 danh mục thời trang chủ đạo (nhanh, tiêu biểu).
    - "full": Toàn bộ 143 danh mục có trong styles.csv.
    """
    return FULL_SEARCH_BENCHMARK_CASES if mode == "full" else CORE_SEARCH_BENCHMARK_CASES
