"use client"

import {Suspense, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {LuChevronRight} from "react-icons/lu";
import {LoadingPage} from "@/components/loading";
import {BsForkKnife} from "react-icons/bs";
import {USER_API} from "@/constants/routeUrl";
import {apiRequest, errorMessage} from "@/lib/api";
import {authLogout} from "@/lib/auth";
import toast from "react-hot-toast";
import {Modal} from "@/components/ui/modal";
import {ZoneManager} from "@/components/settings/zone_manager";
import {ArchiveManager} from "@/components/settings/archive_manager";
import {PushManager} from "@/components/settings/push_manager";
import {syncZones} from "@/lib/zone";

interface UserType {
    username: string;
    first_name: string;
    zone_count: number;
    restaurant_count: number;
    review_count: number;
    version: string;
    release_date: string;
    last_updated_at: string;
}

export default function Page() {
    const router = useRouter()
    const [user, setUser] = useState<UserType | null>(null)
    // 가져오기 뒤 존 관리 목록을 새로 읽게 하려고 key로 다시 만든다
    const [zoneListKey, setZoneListKey] = useState(0)

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
        }).catch((error) => {
            toast.error(errorMessage(error, "이름 수정에 실패했어요. 잠시 후 다시 시도해주세요."))
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
        }).catch((error) => {
            // "현재 비밀번호가 올바르지 않습니다", "비밀번호가 너무 짧습니다" 등 서버가 준 사유를 보여준다
            toast.error(errorMessage(error, "비밀번호 변경에 실패했어요."))
        })
    }

    if (!user) return <LoadingPage/>
    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="h-[100%] pb-6">

                {/* ---- 프로필 헤더 ---- */}
                <div className="px-5 pt-6 pb-1">
                    <div className="flex items-center gap-3.5">
                        <div
                            className="w-14 h-14 rounded-full bg-strong text-white flex items-center justify-center text-xl font-extrabold shrink-0">
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
                                    maxLength={150}
                                    className="flex-1 min-w-0 text-[15px] font-bold text-ink rounded-xl px-3 py-2 bg-fill outline-none focus:ring-2 focus:ring-strong transition-shadow"
                                />
                                <button
                                    onClick={saveName}
                                    className="text-[12px] font-bold text-white bg-strong rounded-full px-3 py-1.5 shrink-0 cursor-pointer sm:hover:bg-strong-hover transition-colors">
                                    저장
                                </button>
                                <button
                                    onClick={() => setIsEditingName(false)}
                                    className="text-[12px] font-bold text-ink3 rounded-full px-3 py-1.5 shrink-0 cursor-pointer sm:hover:bg-fill transition-colors">
                                    취소
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 min-w-0">
                                    <div
                                        className="text-[20px] font-extrabold text-ink tracking-tight truncate">{user.first_name || "이름 없음"}</div>
                                    <div className="text-[13.5px] text-ink3 mt-0.5 truncate">{user.username}</div>
                                </div>
                                <button
                                    onClick={startEditingName}
                                    className="text-[13px] font-bold text-ink bg-surface rounded-full px-3.5 py-2 shrink-0 whitespace-nowrap cursor-pointer sm:hover:bg-fill-hover transition-colors">
                                    프로필 수정
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ---- 전체 기록 (계기판) ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[13px] font-semibold text-ink3 mb-2 px-1">전체 기록</div>
                    <dl className="grid grid-cols-3 rounded-3xl bg-surface py-4 text-center divide-x divide-line">
                        <div>
                            <dt className="text-[12.5px] font-semibold text-ink3">장소</dt>
                            <dd className="text-[20px] font-extrabold text-ink tabular-nums mt-0.5">{user.zone_count}</dd>
                        </div>
                        <div>
                            <dt className="text-[12.5px] font-semibold text-ink3">등록한 음식점</dt>
                            <dd className="text-[20px] font-extrabold text-ink tabular-nums mt-0.5">{user.restaurant_count}</dd>
                        </div>
                        <div>
                            <dt className="text-[12.5px] font-semibold text-ink3">작성한 리뷰</dt>
                            <dd className="text-[20px] font-extrabold text-ink tabular-nums mt-0.5">{user.review_count}</dd>
                        </div>
                    </dl>
                </div>

                {/* ---- 카테고리별 음식점: 길어서 별도 페이지 ---- */}
                <div className="px-5 pt-5">
                    <button
                        onClick={() => router.push("/categories")}
                        className="w-full flex items-center justify-between bg-surface rounded-3xl px-4 py-3.5 cursor-pointer sm:hover:bg-fill transition-colors"
                    >
                        <span className="text-left">
                            <span className="block text-[14px] font-semibold text-ink">카테고리별 음식점</span>
                            <span className="block text-[12px] text-ink3">어느 장소에 어떤 음식점이 있는지, 이름 바꾸기·지우기</span>
                        </span>
                        <LuChevronRight size={16} className="shrink-0 text-ink3"/>
                    </button>
                </div>

                {/* ---- 존 관리 ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[13px] font-semibold text-ink3 mb-2 px-1">장소 관리</div>
                    <div className="bg-surface rounded-3xl overflow-hidden">
                        <ZoneManager key={zoneListKey}/>
                    </div>
                    <p className="text-[11.5px] text-ink3 mt-2 leading-relaxed">
                        장소를 누르면 이름을 바꾸거나 지울 수 있어요.
                    </p>
                </div>

                {/* ---- 알림 ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[13px] font-semibold text-ink3 mb-2 px-1">알림</div>
                    <div className="bg-surface rounded-3xl overflow-hidden">
                        <PushManager/>
                    </div>
                </div>

                {/* ---- 내 기록 ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[13px] font-semibold text-ink3 mb-2 px-1">내 기록</div>
                    <div className="bg-surface rounded-3xl overflow-hidden">
                        <ArchiveManager onImported={() => {
                            fetchUserInfo()
                            syncZones().catch(() => null)
                            setZoneListKey((key) => key + 1)
                        }}/>
                    </div>
                    <p className="text-[11.5px] text-ink3 mt-2 leading-relaxed">
                        서버를 옮기거나 업데이트하기 전에 백업 파일을 받아 두세요.
                    </p>
                </div>

                {/* ---- 설정 ---- */}
                <div className="px-5 py-5">
                    <div className="text-[13px] font-semibold text-ink3 mb-2 px-1">설정</div>
                    <div className="bg-surface rounded-3xl overflow-hidden">
                        <Modal
                            title="비밀번호 변경"
                            open={isChangingPassword}
                            onOpenChange={(open) => open ? setIsChangingPassword(true) : closePasswordForm()}
                            trigger={
                                <button
                                    className="w-full flex items-center justify-between px-4 py-3.5 border-b border-line text-[14px] font-semibold text-ink cursor-pointer sm:hover:bg-fill transition-colors">
                                    비밀번호 변경
                                    <span className="text-ink3">›</span>
                                </button>
                            }
                        >
                            <div className="flex flex-col gap-2.5">
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="현재 비밀번호"
                                    className="text-[13.5px] text-ink rounded-xl px-3 py-2.5 bg-fill outline-none focus:ring-2 focus:ring-strong transition-shadow"
                                />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="새 비밀번호"
                                    className="text-[13.5px] text-ink rounded-xl px-3 py-2.5 bg-fill outline-none focus:ring-2 focus:ring-strong transition-shadow"
                                />
                                <input
                                    type="password"
                                    value={newPasswordConfirm}
                                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.nativeEvent.isComposing) changePassword()
                                    }}
                                    placeholder="새 비밀번호 확인"
                                    className="text-[13.5px] text-ink rounded-xl px-3 py-2.5 bg-fill outline-none focus:ring-2 focus:ring-strong transition-shadow"
                                />
                                <button
                                    onClick={changePassword}
                                    className="w-full text-[13.5px] font-bold text-white bg-strong rounded-lg py-3 mt-1 cursor-pointer sm:hover:bg-strong-hover transition-colors">
                                    변경하기
                                </button>
                            </div>
                        </Modal>

                        <div
                            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-line text-[14px] font-semibold text-ink">
                            버전 정보
                            <span className="text-[12px] text-ink3 font-medium">{user.version}</span>
                        </div>

                        <button
                            onClick={authLogout}
                            className="w-full text-left px-4 py-3.5 text-[14px] font-semibold text-danger-text cursor-pointer sm:hover:bg-accent-soft transition-colors">
                            로그아웃
                        </button>
                    </div>
                </div>
            </div>
        </Suspense>
    )
}
