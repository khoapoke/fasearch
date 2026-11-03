package com.springboot.fasearch.modules.brand.service.interfaces;

import java.util.List;

import com.springboot.fasearch.modules.brand.dto.response.BrandLogoData;
import com.springboot.fasearch.modules.brand.dto.response.BrandRes;

public interface BrandService {
    List<BrandRes> list();
    BrandLogoData logo(String slug);
}
