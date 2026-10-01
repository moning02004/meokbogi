"use client"

import toast from "react-hot-toast"
import {CATEGORY_API} from "@/constants/routeUrl"
import {apiRequest, errorMessage} from "@/lib/api"
import {useCategoryStore} from "@/store/category"
import {CategoryType} from "@/types/zone"

// 음식점을 등록·수정하다가 없는 카테고리가 필요하면 그 자리에서 만든다.
// 상단바·필터에도 바로 보이도록 전역 목록에 더한다.
export function useCreateCategory() {
    const categories = useCategoryStore(state => state.categories)
    const setCategories = useCategoryStore(state => state.setCategories)

    return (keyword: string) => {
        const add = CATEGORY_API.add
        return apiRequest[add.method]<CategoryType>(add.endpoint, {
            body: JSON.stringify({keyword}),
        }).then((category) => {
            setCategories([...categories, {id: category.id, keyword: category.keyword}])
            toast.success(`'${category.keyword}' 카테고리를 만들었어요.`)
            return category
        }).catch((error) => {
            toast.error(errorMessage(error, "카테고리를 만들지 못했어요."))
            throw error
        })
    }
}
