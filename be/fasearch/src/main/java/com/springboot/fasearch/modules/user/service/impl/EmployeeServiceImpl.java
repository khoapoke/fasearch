package com.springboot.fasearch.modules.user.service.impl;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.user.dto.request.EmployeeCreateReq;
import com.springboot.fasearch.modules.user.dto.request.EmployeeUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.EmployeeRes;
import com.springboot.fasearch.modules.user.entity.Employee;
import com.springboot.fasearch.modules.user.mapper.EmployeeMapper;
import com.springboot.fasearch.modules.user.repository.EmployeeRepository;
import com.springboot.fasearch.modules.user.service.interfaces.EmployeeService;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final AccountRepository accountRepository;
    private final EmployeeMapper employeeMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<EmployeeRes> getEmployees(Pageable pageable, String keyword) {
        Specification<Employee> spec = (root, query, cb) -> {
            if (!StringUtils.hasText(keyword)) {
                return cb.conjunction();
            }
            String search = "%" + keyword.trim().toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("firstName")), search),
                    cb.like(cb.lower(root.get("lastName")), search),
                    cb.like(cb.lower(root.get("phoneNumber")), search),
                    cb.like(cb.lower(root.get("cccd")), search)
            );
        };

        Page<Employee> page = employeeRepository.findAll(spec, pageable);
        Page<EmployeeRes> resPage = page.map(employeeMapper::toEmployeeResponse);

        return PageResponse.from(resPage);
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeRes getEmployeeById(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EMPLOYEE_NOT_FOUND));

        return employeeMapper.toEmployeeResponse(employee);
    }

    @Override
    @Transactional
    public EmployeeRes createEmployee(EmployeeCreateReq req) {
        if (employeeRepository.findByPhoneNumber(req.getPhoneNumber()).isPresent()) {
            throw new AppException(ErrorCode.PHONE_NUMBER_ALREADY_EXISTS);
        }

        if (employeeRepository.findByCccd(req.getCccd()).isPresent()) {
            throw new AppException(ErrorCode.CCCD_ALREADY_EXISTS);
        }

        Account account = null;
        if (req.getAccountId() != null) {
            account = accountRepository.findById(req.getAccountId())
                    .orElseThrow(() -> new AppException(ErrorCode.ACCOUNT_NOT_FOUND));

            if (employeeRepository.findByAccountId(req.getAccountId()).isPresent()) {
                throw new AppException(ErrorCode.ACCOUNT_ALREADY_LINKED);
            }
        }

        Employee employee = employeeMapper.toEmployee(req);
        employee.setAccount(account);
        employee.setIsDeleted(false);

        Employee saved = employeeRepository.save(employee);
        log.info("Created employee successfully with ID: {}", saved.getId());

        return employeeMapper.toEmployeeResponse(saved);
    }

    @Override
    @Transactional
    public EmployeeRes updateEmployee(Long id, EmployeeUpdateReq req) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EMPLOYEE_NOT_FOUND));

        if (StringUtils.hasText(req.getPhoneNumber()) && !req.getPhoneNumber().equals(employee.getPhoneNumber())) {
            if (employeeRepository.findByPhoneNumber(req.getPhoneNumber()).isPresent()) {
                throw new AppException(ErrorCode.PHONE_NUMBER_ALREADY_EXISTS);
            }
        }

        if (StringUtils.hasText(req.getCccd()) && !req.getCccd().equals(employee.getCccd())) {
            if (employeeRepository.findByCccd(req.getCccd()).isPresent()) {
                throw new AppException(ErrorCode.CCCD_ALREADY_EXISTS);
            }
        }

        if (req.getAccountId() != null) {
            Long currentAccountId = employee.getAccount() != null ? employee.getAccount().getId() : null;
            if (!req.getAccountId().equals(currentAccountId)) {
                Account account = accountRepository.findById(req.getAccountId())
                        .orElseThrow(() -> new AppException(ErrorCode.ACCOUNT_NOT_FOUND));

                Optional<Employee> existing = employeeRepository.findByAccountId(req.getAccountId());
                if (existing.isPresent() && !existing.get().getId().equals(id)) {
                    throw new AppException(ErrorCode.ACCOUNT_ALREADY_LINKED);
                }
                employee.setAccount(account);
            }
        }

        employeeMapper.updateEmployeeFromReq(req, employee);
        Employee updated = employeeRepository.save(employee);
        log.info("Updated employee successfully with ID: {}", updated.getId());

        return employeeMapper.toEmployeeResponse(updated);
    }

    @Override
    @Transactional
    public void deleteEmployee(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EMPLOYEE_NOT_FOUND));

        employee.setIsDeleted(true);

        // Lock linked account upon employee resignation
        if (employee.getAccount() != null) {
            Account account = employee.getAccount();
            account.setStatus(AccountStatus.LOCKED);
            accountRepository.save(account);
            log.info("Locked linked account ID [{}] for resigned employee ID [{}]", account.getId(), id);
        }

        employeeRepository.save(employee);
        log.info("Soft deleted employee successfully with ID: {}", id);
    }
}
