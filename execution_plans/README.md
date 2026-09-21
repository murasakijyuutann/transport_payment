# Execution Plans Index

Detailed, phase-by-phase build guides for the TypeScript overhaul described in [`ts_payment_overhaul_v1.md`](../ts_payment_overhaul_v1.md).

| Phase | File | Milestone |
|-------|------|-----------|
| 0 | [phase_0_execution_plan.md](phase_0_execution_plan.md) | Skeleton: health check + Vite |
| 0 audit | [phase_0_audit.md](phase_0_audit.md) | What was built / verified for Phase 0 |
| 1 | [phase_1_execution_plan.md](phase_1_execution_plan.md) | Account + network data |
| 1 audit | [phase_1_audit.md](phase_1_audit.md) | What was built / verified for Phase 1 |
| 2 | [phase_2_execution_plan.md](phase_2_execution_plan.md) | **Tap & journey core** (primary) |
| 2 audit | [phase_2_audit.md](phase_2_audit.md) | What was built / verified for Phase 2 |
| 3 | [phase_3_execution_plan.md](phase_3_execution_plan.md) | Fare engine |
| 3 audit | [phase_3_audit.md](phase_3_audit.md) | What was built / verified for Phase 3 |
| 4 | [phase_4_execution_plan.md](phase_4_execution_plan.md) | Wallet deduction & ledger |
| 4 audit | [phase_4_audit.md](phase_4_audit.md) | What was built / verified for Phase 4 |
| 5 | [phase_5_execution_plan.md](phase_5_execution_plan.md) | Daily cap |
| 5 audit | [phase_5_audit.md](phase_5_audit.md) | What was built / verified for Phase 5 |
| 6 | [phase_6_execution_plan.md](phase_6_execution_plan.md) | Incomplete journey job |
| 6 audit | [phase_6_audit.md](phase_6_audit.md) | What was built / verified for Phase 6 |
| 7 | [phase_7_execution_plan.md](phase_7_execution_plan.md) | Frontend dashboard |
| 7 audit | [phase_7_audit.md](phase_7_audit.md) | What was built / verified for Phase 7 |
| 8 | [phase_8_execution_plan.md](phase_8_execution_plan.md) | Polish & tests |
| 8 audit | [phase_8_audit.md](phase_8_audit.md) | What was built / verified for Phase 8 |
| S1–S3 | [security_hardening_plan.md](security_hardening_plan.md) | **Post-v1 security:** ownership, taps, settlement |
| S1 audit | [security_s1_audit.md](security_s1_audit.md) | Ownership & roles |

**How to use:** finish one phase’s acceptance criteria before starting the next. Phase 2 is the first demo-worthy backend milestone; Phase 7 is the first full browser demo. **Phases 0–8 are complete for v1.**

**Next (optional):** [`security_hardening_plan.md`](security_hardening_plan.md) — milestones S1 ownership → S2 authenticated taps → S3 atomic settlement.

**Stack decision:** greenfield `backend/` + `frontend/` Node/TS rewrite. The legacy Spring Boot tree was removed after Phase 8.
