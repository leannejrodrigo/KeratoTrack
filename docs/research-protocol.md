# Research protocol (provisional)

**Status:** provisional direction, drafted in Phase 0. This is not a final
commitment or a pre-registered protocol. No experiments have been run, and no
dataset has been selected or audited.

**Not yet established:** this document does not claim that the question is novel
or publishable. Finding that out requires a systematic literature review and a
proper dataset audit. The review may show that the question has already been
answered, in which case the direction will change.

The protocol should be finalised and committed to Git before final test results
are seen, so that there is a record of the methods having been chosen in advance.

## 1. Area of interest

> Evaluating the robustness, calibration and uncertainty of machine-learning
> models for keratoconus classification when clinical measurements are missing
> or corneal images are degraded.

## 2. Provisional research question

When clinical measurements are missing or corneal images are degraded, how do
the discrimination, calibration and uncertainty estimates of image-only,
tabular-only and multimodal keratoconus classifiers change?

Possible sub-questions:

1. **Robustness:** how quickly does performance fall as degradation or
   missingness increases, and does this differ between model types?
2. **Calibration:** do predicted probabilities remain trustworthy under these
   conditions, and do calibration methods fitted on clean data still help?
3. **Uncertainty:** does estimated uncertainty rise as inputs get worse, and does
   it identify the predictions most likely to be wrong?

## 3. Why this might matter

These are reasons to investigate, not findings.

- **Real data is imperfect.** A measurement may be unavailable or an image may be
  of poor quality, whereas evaluation data is often complete and filtered.
- **Accuracy is not the whole story.** A confidently wrong prediction can be more
  harmful than an uncertain one, so a model's estimate of its own reliability is
  worth studying alongside its accuracy.
- **High clean-data scores can hide fragility.** A model could score well on
  clean data and still fail sharply when inputs change.
- **Multimodal models may behave differently.** A second input could add
  resilience, or could add a new way to fail. Which applies is an open question
  here.

## 4. Potential experimental comparisons

All of these are candidates. The final protocol will reduce them, since each
extra comparison adds work and makes false positives more likely.

**Baselines.** Complex models should have to beat simple ones:

- Majority-class prediction.
- A threshold on one clinical measurement, chosen using training data only.
- Logistic regression and gradient-boosted trees on tabular data.

**Inputs:**

- Tabular only, image only, and multimodal.
- Single corneal map against multiple maps.
- With and without demographic variables, since these may act as confounders.

**Fusion and missing-data handling:**

- Late fusion (combining predictions) against intermediate fusion (combining
  learned features).
- Simple imputation, imputation with missingness indicators, and models that
  natively handle missing values.
- Training with and without modality dropout, which randomly hides inputs during
  training so the model learns to cope without them.

**Missing clinical measurements.** The mechanism matters as well as the amount:

| Mechanism | Meaning | Example |
|---|---|---|
| MCAR (missing completely at random) | Unrelated to any data | A value is randomly not recorded |
| MAR (missing at random) | Depends on other observed data | Recording rates differ by age group |
| MNAR (missing not at random) | Depends on the missing value itself | Extreme values fail to be recorded |

**Image degradation.** Applied at graded severity levels:

- Blur, reduced resolution, compression and noise.
- Missing regions, or an entire map being absent.

Simulated degradation may not match real-world image problems. Each type needs a
justification, ideally with clinical input, and results must not be described as
real-world robustness.

**Calibration and uncertainty methods:**

- Uncalibrated models against temperature scaling, which adjusts the confidence
  of a trained model using validation data.
- Single models against deep ensembles and Monte Carlo dropout.
- Conformal prediction, while noting that its coverage guarantee assumes
  exchangeable data. Correlated eyes and degraded test inputs may both break this
  assumption, so that needs investigating rather than assuming.

**Training and test conditions:** clean or degraded training data against clean
or degraded test data.

**Deferred:** explainability is outside the current focus and may be revisited
later.

## 5. Potential evaluation metrics

| Property | Candidate metrics | Question answered |
|---|---|---|
| Discrimination | AUROC, AUPRC | Does the model rank positive cases above negative ones? |
| Threshold performance | Sensitivity, specificity, F1, with thresholds set on validation data | What errors occur at an operating point? |
| Calibration | Brier score, negative log-likelihood, ECE, reliability diagrams | Do predicted probabilities match observed frequencies? |
| Uncertainty quality | Risk-coverage curves, AUROC of uncertainty for detecting errors | Does uncertainty identify likely mistakes? |
| Conformal methods | Empirical coverage, prediction set size | Do prediction sets achieve their target coverage? |
| Robustness | Performance against severity curves, area under those curves | How gradually does performance decline? |
| Subgroups | The above by sex and age group, where numbers allow | Is performance uneven across groups? |

**Reporting requirements:**

- Report confidence intervals, using a bootstrap that resamples **patients**
  rather than eyes.
- Report results across several random seeds.
- Report calibration alongside discrimination, as AUROC ignores calibration.
- ECE depends on its binning method, so report the method and do not use ECE
  alone.
- Choose one primary metric for each sub-question before final testing, and
  account for multiple comparisons.
- Check reporting guidelines such as TRIPOD+AI and CLAIM, and consider PROBAST+AI
  when assessing risk of bias.

## 6. Candidate dataset and limitations to investigate

CornOrb is a **candidate** dataset. It has not been selected, and its suitability
remains undetermined until an audit is complete.

### Audit findings

None recorded yet. Findings will be added here only after they have been
reproduced with a saved, scripted audit run against a recorded dataset version
and checksum. Each finding will cite the script and output that produced it.

### Questions the audit must answer

**Population and generalisability:**

- How many sites, devices and populations are represented?
- Does the case mix include early or subtle disease? If not, performance may
  reflect an easier task than real-world use.
- Are age and sex imbalanced between classes in ways that could confound results?

**Labels:**

- Who assigned labels, using what criteria?
- Were the labels based on the same maps and values that the models receive? If
  so, the models may be learning to reproduce that judgement, rather than an
  independent ground truth.
- Is there any measure of agreement between labellers?

**Data integrity:**

- Does every record link to the right images, and is anything missing?
- Which values are impossible or implausible, and what is the rule for handling
  them? Report results with and without exclusions.
- Were images filtered for quality before release? If so, the data may already
  under-represent the degradation we want to study.
- Do any values or images come from the same underlying exam, so that modalities
  are less independent than they appear?
- Do the documentation, paper and data files agree on version, licence, counts,
  file names and column names? Record any mismatches.
- How easily can the classes be separated on clean data? Establish this through
  baseline experiments, such as a single-variable threshold and logistic
  regression, rather than assuming it. If separation turns out to be near
  perfect, clean-data scores would leave little room to measure the effect of
  degradation.

**What the data cannot support:** cross-sectional data cannot support claims about
disease progression. Data from one device or site cannot establish performance
on others. Each conclusion must stay within what the audited data supports.

## 7. Patient-level data separation

**All data from a patient must be in exactly one of the training, validation or
test sets.**

A person's two eyes are correlated, and repeated scans of one eye are even more
so. If a patient appears on both sides of a split, the test set contains near
copies of training data. The model can then appear to perform well by recognising
familiar anatomy, so the estimate of performance on new patients is inflated.

Requirements:

- Split by patient using group-aware methods, stratified by label.
- Add an automated test that fails if any patient appears in more than one split.
- Do not rely on supplied splits until they have been verified.
- Check that patient identifiers are themselves reliable, as a corrupted or
  duplicated identifier could cause leakage without any visible error.
- Fit preprocessing and imputation on **training data only**. In
  cross-validation, refit them inside each training fold.
- Use validation data for model selection, hyperparameter choice, threshold
  choice and fitting calibration, where appropriate. If the same validation data
  is used for both selection and calibration, the calibration estimate may be
  optimistic, so the final protocol must record how this is handled (for
  example, separate selection and calibration subsets).
- Keep the final test set unused until the methods have been fixed.

### Planned integrity controls

These controls are planned for phase R2 and will be described here in detail
once they exist and have been tested.

- **Frozen split with a separate manifest.** Patient-to-split assignments are
  stored outside the repository with the data. A committed manifest records only
  non-identifying information: dataset version and checksum, split method,
  parameters and seed, code commit, counts per split, and the checksum of the
  assignment file. It never contains patient codes.
- **Near-duplicate checks** on both tabular values and images, including
  records that appear under different identifiers.
- **Separate test storage and one guarded evaluation command**, which refuses
  to run unless the protocol is final, the working tree is clean and all
  checksums match.
- **An evaluation access log** with sequential evaluation numbers, recording the
  commit, configuration, purpose and result checksum for every test-set access.
  Each entry includes a checksum of the previous entry, so later edits are
  detectable.

**Limitations of these controls.** They make test-set access deliberate,
recorded and visible. They cannot make unrecorded access impossible.

- Git history can be rewritten, and a local log file can be edited before it is
  committed. The chained checksums make edits detectable, not impossible.
- Timestamps are self-reported.
- Code outside the pipeline, such as an ad-hoc notebook, can read files directly.
- No log can prove that something did not happen.

The integrity of the final evaluation therefore also rests on committing the
finalised protocol in advance, honest reporting of the number of test
evaluations, and labelling any analysis influenced by test results as
exploratory.

## 8. Duplicate and repeated examinations

Datasets may contain several records for the same eye. The audit must determine:

- How many exact and near-duplicate records there are, based on both tabular
  values and image similarity. Identifiers alone may not reveal them.
- Whether repeats come from the same visit or from separate visits. Do not assume
  that they are longitudinal.
- Whether large differences within a repeated pair reflect measurement variation,
  data errors or mislinked records.
- How many distinct patients and eyes really exist, as this determines the true
  sample size.

A rule must then be decided and documented before modelling, such as keeping one
record per eye according to a pre-set criterion. Treating repeats as independent
would give overconfident results. If verified as true repeats, they might support
a small analysis of prediction stability, but that remains only a possibility.

## 9. Embedded labels and shortcut learning

Shortcut learning occurs when a model finds an easy cue that predicts the label
in this dataset, but has no meaningful connection to the disease. Such a model
can score highly and still fail elsewhere. Corneal maps exported from clinical
software could plausibly contain such cues.

The images must be inspected for:

- Burned-in text, numbers, indices, legends or scale bars.
- Colour scales that differ between images or are normalised per image.
- Any identifying or diagnostic text, which would also be a privacy issue that
  should be reported to the dataset authors.
- Differences in layout, cropping, resolution or file metadata between classes.
- File names or folder structures that reveal the label.

Possible checks:

- Viewing a random sample from each class, and all of the highest-confidence and
  most surprising predictions.
- Masking suspected regions and measuring the effect on performance.
- Using attribution methods to see where the model focuses, while treating these
  only as supporting evidence, because they can be misleading.
- Training a model on deliberately uninformative regions: if it still performs
  well, something is wrong.

## 10. Licensing and permitted use

Before any download or use, check and record:

- The licence attached to the **exact version** being used, on the original source
  page. Different versions may have different terms.
- Any terms on redistribution, derivative works, attribution and commercial use.
- That the dataset licence and the licence of any paper describing it are separate.
  Figures or text from a paper need their own permission.
- What the source says about consent, anonymisation and ethics approval. If this
  is unclear, seek clarification from the dataset authors before relying on it.
- Whether this project needs its own institutional or ethics review. Check this
  with an appropriate institution or independent reviewer rather than assuming
  it does not.

The dataset itself will not be committed to this repository. It is stored
outside the repository, in the folder named by the `KERATOTRACK_DATA_DIR`
environment variable. Only the source, version and checksum will be recorded,
along with the required attribution. The repository's MIT licence does not
apply to any dataset ([licensing.md](licensing.md)).

## 11. Experimental results and clinical validation

Results from this project are **experimental**. They describe how particular
models performed on a particular dataset under particular conditions.

| An experimental result can show | It does not show |
|---|---|
| A model's performance on a held-out set from this dataset | Performance in clinical use |
| Agreement with the labels provided | That the model is correct about a patient's true condition |
| Behaviour under simulated degradation | Behaviour under real-world image problems |
| An association within this dataset | Performance on other devices, sites or populations |
| Discrimination between labelled groups in cross-sectional data | Any ability to predict or detect disease progression |

Clinical validation would require, at minimum, independent external data,
prospective evaluation in the intended setting, clinical partners, ethics
oversight and relevant regulatory consideration. None of these is planned here.

Therefore, this project must not claim clinical validity, diagnostic accuracy or
readiness for use. Any write-up should state these limitations explicitly, and
research outputs must stay separate from the Companion
([safety-boundaries.md](safety-boundaries.md), rule 8).

## 12. Before this protocol can be finalised

1. Carry out a systematic literature review, and record the search terms and
   sources used.
2. Verify the dataset licence and permitted use.
3. Complete a scripted, reproducible dataset audit, covering sections 6 to 9.
4. Make a documented decision to continue, change dataset or change direction.
5. Narrow the comparisons, and fix the primary metrics, severity levels and
   exclusion rules.
6. Seek review from an independent reviewer, to be identified. Clinical input
   would be valuable if feasible, but no clinician or supervisor has agreed to
   take part, and none should be assumed.
7. Commit the finalised protocol before evaluating on the final test set.

## Change log

| Date | Change |
|---|---|
| 2026-11-07 | Provisional first draft created during Phase 0 |
| 2026-11-07 | Removed unverified preliminary dataset observations; findings to be recorded only after reproducible audit |
| 2026-11-07 | Clarified training-only preprocessing and the role of validation data; added planned integrity controls and their limitations; data stored outside the repository; reviewer changed to "independent reviewer, to be identified" |
