"use client"

import {Suspense, useEffect, useState} from "react"
import {LoadingPage} from "@/components/loading";
import {BsForkKnife} from "react-icons/bs";
import {USER_API} from "@/constants/routeUrl";
import {apiRequest} from "@/lib/api";
import {authLogout} from "@/lib/auth";
import toast from "react-hot-toast";

interface UserType {
    username: string;
    first_name: string;
    zone_count: number;
    restaurant_count: number;
    review_count: number;
    version: string;
}

export default function Page() {
    const [user, setUser] = useState<UserType | null>(null)

    // 이름 수정
    const [isEditingName, setIsEditingName] = useState(false)
    const [nameInput, setNameInput] = useState("")

    // 비밀번호 변경
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("")

    const fetchUserInfo = () => {
        const userRetrieveAPI = USER_API.retrieve
        return apiRequest[userRetrieveAPI.method]<UserType>(userRetrieveAPI.endpoint).then((response: UserType) => {
            setUser(response)
        })
    }

    useEffect(() => {
        fetchUserInfo()
    }, []);

    const startEditingName = () => {
        setNameInput(user?.first_name ?? "")
        setIsEditingName(true)
    }

    const saveName = () => {
        const userUpdateAPI = USER_API.update
        apiRequest[userUpdateAPI.method](userUpdateAPI.endpoint, {
            body: JSON.stringify({first_name: nameInput.trim()})
        }).then(() => {
            setIsEditingName(false)
            fetchUserInfo()
        }).catch(() => {
            toast.error("이름 수정에 실패했어요. 잠시 후 다시 시도해주세요.")
        })
    }

    const closePasswordForm = () => {
        setIsChangingPassword(false)
        setCurrentPassword("")
        setNewPassword("")
        setNewPasswordConfirm("")
    }

    const changePassword = () => {
        if (!currentPassword || !newPassword || !newPasswordConfirm) {
            toast.error("모든 항목을 입력해주세요.")
            return;
        }
        if (newPassword !== newPasswordConfirm) {
            toast.error("새 비밀번호가 일치하지 않아요.")
            return;
        }

        const changePasswordAPI = USER_API.changePassword
        apiRequest[changePasswordAPI.method](changePasswordAPI.endpoint, {
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
                new_password_confirm: newPasswordConfirm,
            })
        }).then(() => {
            toast.success("비밀번호가 변경되었어요.")
            closePasswordForm()
        }).catch(() => {
            toast.error("비밀번호 변경에 실패했어요. 현재 비밀번호를 확인해주세요.")
        })
    }

    if (!user) return <LoadingPage/>
    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="h-[100%] pb-6">

                {/* ---- 프로필 헤더 ---- */}
                <div className="bg-white px-5 py-6 border-b border-[#E7E0CF]">
                    <div className="flex items-center gap-3.5">
                        <div
                            className="w-14 h-14 rounded-full bg-[#24564A] text-white flex items-center justify-center text-xl font-extrabold shrink-0">
                            <BsForkKnife size={22}/>
                        </div>

                        {isEditingName ? (
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                <input
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.nativeEvent.isComposing) saveName()
                                    }}
                                    autoFocus
                                    placeholder="이름"
                                    className="flex-1 min-w-0 text-[15px] font-bold text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2 outline-none focus:border-[#24564A] transition-colors"
                                />
                                <button
                                    onClick={saveName}
                                    className="text-[12px] font-bold text-white bg-[#24564A] rounded-full px-3 py-1.5 shrink-0 cursor-pointer sm:hover:bg-[#1c443a] transition-colors">
                                    저장
                                </button>
                                <button
                                    onClick={() => setIsEditingName(false)}
                                    className="text-[12px] font-bold text-[#8A8172] rounded-full px-3 py-1.5 shrink-0 cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors">
                                    취소
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 min-w-0">
                                    <div
                                        className="text-[17px] font-extrabold text-[#211D17] tracking-tight truncate">{user.first_name || "이름 없음"}</div>
                                    <div className="text-[12.5px] text-[#8A8172] mt-0.5 truncate">{user.username}</div>
                                </div>
                                <button
                                    onClick={startEditingName}
                                    className="text-[12px] font-bold text-[#24564A] border border-[#24564A] rounded-full px-3 py-1.5 shrink-0 whitespace-nowrap cursor-pointer sm:hover:bg-[#E4EEEA] transition-colors">
                                    프로필 수정
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ---- 전체 기록 (계기판) ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">전체 기록</div>
                    <div
                        className="rounded-[20px] bg-[#17372F] px-4.5 pt-4.5 pb-4 text-[#EFF4F1] relative overflow-hidden">
                        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#B9CFC8] mb-4">
                            <BsForkKnife size={12}/>
                            지금까지의 기록
                        </div>
                        <div className="flex">
                            <div className="flex-1 text-center">
                                <div
                                    className="mx-1.5 font-mono text-[24px] font-semibold rounded-[10px] py-2 bg-white/[0.06] border border-white/[0.12]">
                                    {user.zone_count}
                                </div>
                                <p className="text-[10.5px] font-medium text-[#9FB6AE] mt-2">존</p>
                            </div>
                            <div className="flex-1 text-center">
                                <div
                                    className="mx-1.5 font-mono text-[24px] font-semibold rounded-[10px] py-2 bg-white/[0.06] border border-white/[0.12]">
                                    {user.restaurant_count}
                                </div>
                                <p className="text-[10.5px] font-medium text-[#9FB6AE] mt-2">등록한 음식점</p>
                            </div>
                            <div className="flex-1 text-center">
                                <div
                                    className="mx-1.5 font-mono text-[24px] font-semibold rounded-[10px] py-2 bg-white/[0.06] border border-white/[0.12]">
                                    {user.review_count}
                                </div>
                                <p className="text-[10.5px] font-medium text-[#9FB6AE] mt-2">작성한 리뷰</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---- 설정 ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">설정</div>
                    <div className="bg-white border border-[#E7E0CF] rounded-2xl overflow-hidden">
                        <button
                            onClick={() => isChangingPassword ? closePasswordForm() : setIsChangingPassword(true)}
                            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#F0EBDD] text-[14px] font-semibold text-[#211D17] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors">
                            비밀번호 변경
                            <span className="text-[#B7AF9F]">{isChangingPassword ? "︿" : "›"}</span>
                        </button>

                        {isChangingPassword && (
                            <div className="px-4 py-3.5 border-b border-[#F0EBDD] flex flex-col gap-2.5 bg-[#FBFAF6]">
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="현재 비밀번호"
                                    className="text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors bg-white"
                                />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="새 비밀번호"
                                    className="text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors bg-white"
                                />
                                <input
                                    type="password"
                                    value={newPasswordConfirm}
                                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.nativeEvent.isComposing) changePassword()
                                    }}
                                    placeholder="새 비밀번호 확인"
                                    className="text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors bg-white"
                                />
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={changePassword}
                                        className="flex-1 text-[13px] font-bold text-white bg-[#24564A] rounded-lg py-2.5 cursor-pointer sm:hover:bg-[#1c443a] transition-colors">
                                        변경하기
                                    </button>
                                    <button
                                        onClick={closePasswordForm}
                                        className="text-[13px] font-bold text-[#8A8172] rounded-lg px-4 py-2.5 cursor-pointer sm:hover:bg-white transition-colors">
                                        취소
                                    </button>
                                </div>
                            </div>
                        )}

                        <div
                            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#F0EBDD] text-[14px] font-semibold text-[#211D17]">
                            버전 정보
                            <span className="text-[12px] text-[#B7AF9F] font-medium">{user.version}</span>
                        </div>
                        <button
                            onClick={authLogout}
                            className="w-full text-left px-4 py-3.5 text-[14px] font-semibold text-[#C23B1E] cursor-pointer sm:hover:bg-[#FDEBE1] transition-colors">
                            로그아웃
                        </button>
                    </div>
                </div>
            </div>
        </Suspense>
    )
}
