import random

# "오늘 어디서 먹지" 뽑기 가중치.
# 오래 안 간 곳, 만족도가 높은 곳일수록 잘 뽑히게 해서 매번 먹던 집만 시키는 습관에서 벗어나게 한다.

MAX_IDLE_DAYS = 180       # 이보다 오래 안 간 곳은 같은 가중치로 본다
UNVISITED_IDLE_DAYS = 60  # 등록만 하고 안 가본 곳은 두 달 안 간 곳과 비슷하게 대접한다
DISAPPOINTING_AVG = -0.6  # 화면의 "실망" 라벨과 같은 경계


def pick_weight(review_avg, latest_ordered_at, today):
    if latest_ordered_at is None:
        idle_days = UNVISITED_IDLE_DAYS
    else:
        idle_days = min(max((today - latest_ordered_at).days, 0), MAX_IDLE_DAYS)

    # 어제 먹은 집도 0은 아니다 (가능성을 완전히 막지 않는다)
    idle_factor = 1 + idle_days / 30
    # 평균 -1 ~ 1 → 0.5 ~ 2.5, 기록이 없으면 중간값
    rating_factor = 1.5 + (review_avg if review_avg is not None else 0)
    return idle_factor * rating_factor


def is_disappointing(review_avg):
    return review_avg is not None and review_avg <= DISAPPOINTING_AVG


def pick_restaurant(restaurants, today, exclude_disappointing=True, rng=random):
    candidates = [r for r in restaurants if not (exclude_disappointing and is_disappointing(r.review_avg))]
    if not candidates:
        return None
    weights = [pick_weight(r.review_avg, r.latest_ordered_at, today) for r in candidates]
    return rng.choices(candidates, weights=weights, k=1)[0]
