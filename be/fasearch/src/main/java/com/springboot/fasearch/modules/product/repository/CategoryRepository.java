package com.springboot.fasearch.modules.product.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.springboot.fasearch.modules.product.entity.Category;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    boolean existsByCategoryName(String categoryName);

    /**
     * True when another live category already has this name, ignoring case and surrounding
     * spaces. Vietnamese diacritics stay significant. {@code excludeId} skips the category being renamed.
     */
    @Query("select count(c) > 0 from Category c where lower(trim(c.categoryName)) = lower(trim(:name)) "
            + "and (:excludeId is null or c.id <> :excludeId)")
    boolean existsLiveName(@org.springframework.data.repository.query.Param("name") String name,
            @org.springframework.data.repository.query.Param("excludeId") Long excludeId);

    Optional<Category> findByCategoryName(String categoryName);

    /**
     * Categories holding published, non-deleted products with their counts, over the
     * whole catalog (not the first page). Historical empty rows are excluded.
     */
    @Query("select c.id, c.categoryName, count(p) from Category c "
            + "left join Product p on p.category = c "
            + "and p.publicationStatus = com.springboot.fasearch.modules.publish.entity.PublicationStatus.PUBLISHED "
            + "and p.isDeleted = false "
            + "where c.isDeleted = false group by c.id, c.categoryName having count(p) > 0 order by count(p) desc")
    List<Object[]> findNonEmptyWithPublishedCounts();
}
