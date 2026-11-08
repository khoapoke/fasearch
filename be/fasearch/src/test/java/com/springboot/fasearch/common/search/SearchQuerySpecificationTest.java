package com.springboot.fasearch.common.search;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.mapper.UserMapper;
import com.springboot.fasearch.modules.user.repository.MembershipTierRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.modules.user.service.impl.UserServiceImpl;
import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

class SearchQuerySpecificationTest {

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void customerKeywordUsesTheNormalisedBoundPatternAndEmailJoin() {
        UserRepository repository = mock(UserRepository.class);
        when(repository.findAll(any(Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));
        UserServiceImpl service = new UserServiceImpl(repository, mock(AccountRepository.class),
                mock(MembershipTierRepository.class), mock(UserMapper.class), mock(LoyaltyService.class),
                mock(DeleteGuards.class), mock(SoftDeleteRecorder.class));

        service.getCustomers(PageRequest.of(0, 10), "  Quần  100%_  ", null, null);

        ArgumentCaptor<Specification> captor = ArgumentCaptor.forClass(Specification.class);
        verify(repository).findAll(captor.capture(), any(org.springframework.data.domain.Pageable.class));

        Root<Customer> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        Path<String> searchText = mock(Path.class);
        Join<Customer, Object> account = mock(Join.class);
        Path<String> email = mock(Path.class);
        Expression<String> lowerEmail = mock(Expression.class);
        Predicate or = mock(Predicate.class);
        Predicate and = mock(Predicate.class);

        when(root.<String>get("searchText")).thenReturn(searchText);
        when(root.<Customer, Object>join("account", JoinType.LEFT)).thenReturn(account);
        when(account.<String>get("email")).thenReturn(email);
        when(cb.lower(email)).thenReturn(lowerEmail);
        when(cb.and(any(Predicate[].class))).thenReturn(and);

        captor.getValue().toPredicate((Root) root, query, cb);

        String expected = "%quan 100\\%\\_%";
        verify(cb).like(eq(searchText), eq(expected), eq(SearchTextNormalizer.LIKE_ESCAPE));
        verify(cb).like(eq(lowerEmail), eq(expected), eq(SearchTextNormalizer.LIKE_ESCAPE));
        verify(cb).and(any(Predicate[].class));
    }
}
