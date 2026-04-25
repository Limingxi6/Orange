from __future__ import annotations

from typing import Any, Dict

from .feature_extractor import extract_visual_features
from .grading_rules import compute_quality_scores, decide_grade, load_grading_config
from .pricing_rules import calculate_price_range, load_price_config
from .schema import FruitGradeResult, parse_fruit_input


def predict_grade_and_price(
    payload: Dict[str, Any],
    grading_config_path: str | None = None,
    price_config_path: str | None = None,
    llm_explainer=None,
) -> Dict[str, Any]:
    input_data = parse_fruit_input(payload)

    grading_cfg = load_grading_config(grading_config_path)
    price_cfg = load_price_config(price_config_path)

    features = extract_visual_features(input_data)
    scores = compute_quality_scores(input_data=input_data, features=features, config=grading_cfg)

    grade_decision = decide_grade(scores=scores, config=grading_cfg)
    price_result = calculate_price_range(
        input_data=input_data,
        grade=grade_decision.grade,
        scores=scores,
        config=price_cfg,
    )

    risk_warning = _build_risk_warning(scores=scores, grade=grade_decision.grade)
    reason = f"{grade_decision.reason}{price_result.reason}"

    factors = {
        "quality": {
            **grade_decision.factors,
            "featureSource": features.feature_source,
        },
        "pricing": price_result.factors,
    }

    result = FruitGradeResult(
        variety=input_data.variety,
        grade=grade_decision.grade,
        color_score=scores.color_score,
        defect_ratio=scores.defect_ratio,
        size_score=scores.size_score,
        maturity_score=scores.maturity_score,
        retail_min_price=price_result.retail_min_price,
        retail_max_price=price_result.retail_max_price,
        wholesale_min_price=price_result.wholesale_min_price,
        wholesale_max_price=price_result.wholesale_max_price,
        reason=reason,
        risk_warning=risk_warning,
        factors=factors,
    )

    api_output = result.to_api_dict()

    if llm_explainer is not None:
        llm_result = llm_explainer.explain(api_output)
        if llm_result.get("narrative"):
            api_output["llmNarrative"] = str(llm_result["narrative"])
        if llm_result.get("riskWarning"):
            api_output["llmRiskWarning"] = str(llm_result["riskWarning"])
        api_output["llm"] = {
            "enabled": True,
            "raw": llm_result.get("raw"),
        }
    else:
        api_output["llm"] = {"enabled": False}

    return api_output


def _build_risk_warning(scores, grade: str) -> str:
    warnings = []

    if scores.defect_ratio > 0.12:
        warnings.append("缺陷率偏高，销售退货风险上升")
    if scores.maturity_score < 65:
        warnings.append("成熟度偏低，短期口感风险较高")
    if scores.size_score < 62:
        warnings.append("果径偏小，渠道接受度可能下降")
    if grade == "C":
        warnings.append("当前等级为C，建议优先走批发或加工渠道")

    if not warnings:
        return "暂无明显销售风险，建议按常规节奏出货"

    return "；".join(warnings)


def predict_from_dict(
    payload: Dict[str, Any],
    grading_config_path: str | None = None,
    price_config_path: str | None = None,
    llm_explainer=None,
) -> Dict[str, Any]:
    return predict_grade_and_price(
        payload=payload,
        grading_config_path=grading_config_path,
        price_config_path=price_config_path,
        llm_explainer=llm_explainer,
    )


if __name__ == "__main__":
    # TODO: 后续补充批量预测接口和历史价格回放校验。
    sample = {
        "image_path": "./data/sample_fruit.jpg",
        "variety": "纽荷尔脐橙",
        "channel": "ecommerce",
        "packaging": "gift",
        "region": "湖北宜昌",
        "brix": 12.6,
        "diameter_mm": 75,
    }
    print(predict_from_dict(sample))
