from keratotrack_research import audit, synthetic


def checks(findings):
    return {f.check: f for f in findings}


def test_clean_synthetic_data_has_no_blockers_or_warnings(clean_df):
    found = audit.run_audit(clean_df)
    assert not audit.has_blockers(found)
    assert [f for f in found if f.severity == "warning"] == []


def test_audit_finds_every_planted_issue(dirty_df):
    found = checks(audit.run_audit(dirty_df))
    inj = synthetic.INJECTED
    assert found["ids.variant_spellings"].severity == "blocker"
    assert any(inj["case_whitespace_id"].strip() in ex.lower() for ex in found["ids.variant_spellings"].examples)
    assert inj["impossible_kmax_exam"] in found["values.implausible.kmax_d"].examples
    assert found["duplicates.exact_rows"].count == 1
    assert inj["conflicting_sex_patient"].lower() in found["consistency.sex"].examples
    assert found["values.missing.thinnest_um"].count == 1


def test_near_duplicates_reported_at_two_levels(clean_df):
    found = checks(audit.run_audit(clean_df))
    loose = found["duplicates.near_same_eye.loose"].count
    strict = found.get("duplicates.near_same_eye.strict")
    assert loose >= (strict.count if strict else 0)


def test_findings_never_use_clinical_wording(dirty_df):
    banned = ("abnormal", "disease", "diagnos", "severe", "progress", "risk")
    for f in audit.run_audit(dirty_df):
        assert not any(b in f.message.lower() for b in banned), f.message
