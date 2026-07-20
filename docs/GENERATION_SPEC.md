# Question Generation Spec (STRICT — follow exactly)

## Output format
Each topic = ONE JSON file. The file is a JSON object:

```json
{
  "unit": "unit1",
  "unitName": "Analog and Digital Electronics circuits",
  "topic": "transistors_basics",
  "topicName": "Transistors - Basics & Working Principle",
  "questions": [
    {
      "id": "u1_transistors_basics_q1",
      "question": "एक NPN Transistor जब active region में काम करता है, तो उसका emitter-base junction और collector-base junction क्रमशः किस प्रकार bias होते हैं?",
      "options": [
        "Forward biased और reverse biased",
        "Reverse biased और forward biased",
        "दोनों forward biased",
        "दोनों reverse biased"
      ],
      "correctIndex": 0,
      "explanation": "Active region में amplification के लिए emitter-base junction को forward bias किया जाता है (ताकि carriers inject हों) और collector-base junction को reverse bias किया जाता है (ताकि वे collect हों)। Option B reverse-active mode है, C saturation है, और D cut-off है — इनमें से कोई सामान्य amplification नहीं देता।"
    }
  ]
}
```

## Rules
0. **LANGUAGE (MOST IMPORTANT):** Write the `question`, all `options`, and the `explanation` in **Devanagari Hindi** (proper हिंदी sentences), but keep ALL technical terms in **English** embedded inside the Hindi sentence — e.g. Transistor, forward bias, op-amp, frequency, IGBT, RTD, capacitor, selling price, oxidation, PWM. Do NOT translate technical terms into Hindi. For Chemistry, keep element/compound names in English with standard symbols/formulas — e.g. Sodium (Na), H2SO4, O2. For Maths/Physics numericals: keep numbers, units and formulas as-is, only write the sentence wording in Hindi. Options that are pure technical phrases/numbers can stay in English; connecting words in Hindi.
1. Exactly 4 options per question. `correctIndex` is 0-3 (the index of the correct option).
2. Vary the position of the correct answer across questions (do NOT always put it at index 0). Spread correct answers roughly evenly across 0,1,2,3.
3. `explanation` MUST explain (a) why the correct option is right AND (b) briefly why the other options are wrong/what they actually refer to.
4. `id` format: `u<UNITNUM>_<topic_id>_q<N>` (e.g. `u1_transistors_basics_q1`). For general subjects use `math_`, `phy_`, `chem_` prefixes, e.g. `math_percentage_q1`.
5. Difficulty: ITI / Diploma level, slightly tough — mix of conceptual, applied and small numerical questions. Avoid trivial one-liners and avoid trick/ambiguous wording. No duplicate questions within a file.
6. Questions must be self-contained (no "refer to figure/diagram"). Numerical questions must be solvable from the text.
7. Generate **30 questions per topic file** unless told otherwise.
8. Valid JSON only (double quotes, no trailing commas, escape any inner quotes). No markdown, no comments inside the JSON file.
9. Keep questions strictly within the topic's scope as described in the syllabus.
