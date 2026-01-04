import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, View } from "react-native";
import { AnimationType } from "./PopTip";
import { measureAnchor } from "./measureAnchor";

// ============================================================================
// 全局关闭管理
// ============================================================================

/**
 * 全局数组，存储所有PopTip的关闭函数
 * 当ScrollView触摸时，调用所有注册的关闭函数
 */
const closeFunctions: Set<() => void> = new Set();

/**
 * Hook：注册PopTip的关闭函数
 *
 * 功能：
 * 1. 当PopTip visible时，注册关闭函数到全局数组
 * 2. 当PopTip不可见或卸载时，自动取消注册
 * 3. 使用ref保存最新的onClose，避免依赖变化
 *
 * 使用方式：
 *
 * // 在PopTip内部
 * usePopTipClose(() => {
 *     onClose?.();
 * }, visible);
 *
 * @param onClose PopTip的关闭回调函数
 * @param active PopTip是否激活（绑定到visible状态）
 */
export const usePopTipClose = (onClose: () => void, active: boolean) => {
    // 使用ref保存最新的onClose，避免依赖变化导致频繁重新注册
    const onCloseRef = useRef(onClose);

    // 保持ref最新
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // 注册/取消注册关闭函数
    useEffect(() => {
        if (!active) {
            return;
        }

        // 创建包装函数，使用最新的onClose引用
        const closeFn = () => {
            try {
                onCloseRef.current();
            } catch (error) {
                console.error("PopTip close error:", error);
            }
        };

        // 注册到全局数组
        closeFunctions.add(closeFn);

        // 组件卸载或active变为false时，取消注册
        return () => {
            closeFunctions.delete(closeFn);
        };
    }, [active]);
};

/**
 * Hook：获取关闭所有PopTip的函数
 *
 * 功能：
 * 1. 返回一个函数，调用时会关闭所有已注册的PopTip
 * 2. 使用useCallback优化性能
 *
 * 使用方式：
 *
 * // 在ProductDetailView中
 * const closeAllPopTips = useCloseAllPopTips();
 *
 * <ScrollView
 *     onTouchStart={
 *         closeAllPopTips(); // 关闭所有PopTip
 *         ... // 其他处理
 *     }
 * />
 *
 * @returns 关闭所有PopTip的函数
 */
export const useCloseAllPopTips = () => {
    return useCallback(() => {
        closeFunctions.forEach((fn) => {
            try {
                fn();
            } catch (error) {
                console.error("Error closing PopTip:", error);
            }
        });
    }, []);
};

// ============================================================================
// 动画控制 Hook
// ============================================================================

export type UsePopTipAnimationParams = {
    visible: boolean;
    contentSize: { width: number; height: number };
    positionReady: boolean;
    animType: AnimationType;
    slideDistance: number;
    showDuration: number;
    hideDuration: number;
};

export type UsePopTipAnimationReturn = {
    shouldRender: boolean;
    setShouldRender: (value: boolean) => void;
    opacity: Animated.Value;
    translateY: Animated.Value;
    translateX: Animated.Value;
    transform: any[]; // 使用 any[] 避免类型兼容问题
};

/**
 * PopTip 动画控制 Hook
 *
 * 功能：
 * 1. 控制组件的渲染时机（shouldRender）
 * 2. 管理透明度、位移动画值
 * 3. 根据动画类型执行显示/隐藏动画
 * 4. 构建 transform 样式
 *
 * 动画类型支持：
 * - fade: 淡入淡出
 * - slideUp: 从下往上滑入
 * - slideDown: 从上往下滑入
 * - slideLeft: 从右往左滑入
 * - slideRight: 从左往右滑入
 *
 * @param params 动画配置参数
 * @returns 动画相关的状态和值
 */
export const usePopTipAnimation = ({
    visible,
    contentSize,
    positionReady,
    animType,
    slideDistance,
    showDuration,
    hideDuration,
}: UsePopTipAnimationParams): UsePopTipAnimationReturn => {
    const [shouldRender, setShouldRender] = useState(false);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(0)).current;

    // ===== 动画控制逻辑 =====
    useEffect(() => {
        if (visible) {
            setShouldRender(true);

            const canStartAnimation =
                contentSize.width > 0 &&
                contentSize.height > 0 &&
                positionReady;

            if (canStartAnimation) {
                // 停止所有动画并重置值
                opacity.stopAnimation();
                translateY.stopAnimation();
                translateX.stopAnimation();
                opacity.setValue(0);
                translateY.setValue(0);
                translateX.setValue(0);

                // 根据动画类型设置初始值
                if (animType === "slideUp") {
                    translateY.setValue(slideDistance);
                } else if (animType === "slideDown") {
                    translateY.setValue(-slideDistance);
                } else if (animType === "slideLeft") {
                    translateX.setValue(slideDistance);
                } else if (animType === "slideRight") {
                    translateX.setValue(-slideDistance);
                }

                // 执行显示动画
                requestAnimationFrame(() => {
                    const animations: Animated.CompositeAnimation[] = [
                        Animated.timing(opacity, {
                            toValue: 1,
                            duration: showDuration,
                            useNativeDriver: true,
                        }),
                    ];

                    // 根据类型添加位移动画
                    if (animType === "slideUp" || animType === "slideDown") {
                        animations.push(
                            Animated.timing(translateY, {
                                toValue: 0,
                                duration: showDuration,
                                useNativeDriver: true,
                            }),
                        );
                    } else if (animType === "slideLeft" || animType === "slideRight") {
                        animations.push(
                            Animated.timing(translateX, {
                                toValue: 0,
                                duration: showDuration,
                                useNativeDriver: true,
                            }),
                        );
                    }

                    Animated.parallel(animations).start();
                });
            } else {
                opacity.setValue(0);
            }
        } else {
            if (!shouldRender) {
                return;
            }

            // 停止所有动画
            opacity.stopAnimation();
            translateY.stopAnimation();
            translateX.stopAnimation();

            const animations: Animated.CompositeAnimation[] = [
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: hideDuration,
                    useNativeDriver: true,
                }),
            ];

            // 根据类型添加位移动画
            if (animType === "slideUp") {
                animations.push(
                    Animated.timing(translateY, {
                        toValue: slideDistance,
                        duration: hideDuration,
                        useNativeDriver: true,
                    }),
                );
            } else if (animType === "slideDown") {
                animations.push(
                    Animated.timing(translateY, {
                        toValue: -slideDistance,
                        duration: hideDuration,
                        useNativeDriver: true,
                    }),
                );
            } else if (animType === "slideLeft") {
                animations.push(
                    Animated.timing(translateX, {
                        toValue: slideDistance,
                        duration: hideDuration,
                        useNativeDriver: true,
                    }),
                );
            } else if (animType === "slideRight") {
                animations.push(
                    Animated.timing(translateX, {
                        toValue: -slideDistance,
                        duration: hideDuration,
                        useNativeDriver: true,
                    }),
                );
            }

            Animated.parallel(animations).start(() => {
                setShouldRender(false);
                opacity.setValue(0);
                translateY.setValue(0);
                translateX.setValue(0);
            });
        }
    }, [
        visible,
        contentSize.width,
        contentSize.height,
        positionReady,
        animType,
        slideDistance,
        showDuration,
        hideDuration,
        shouldRender,
    ]);

    // 根据动画类型构建 transform
    const transform: any[] = [];
    if (animType === "slideUp" || animType === "slideDown") {
        transform.push({ translateY });
    }
    if (animType === "slideLeft" || animType === "slideRight") {
        transform.push({ translateX });
    }

    return {
        shouldRender,
        setShouldRender,
        opacity,
        translateY,
        translateX,
        transform,
    };
};

// ============================================================================
// 定位计算 Hook
// ============================================================================

export type UsePopTipPositionParams = {
    visible: boolean;
    anchorRef: React.RefObject<View>;
    placement: "top" | "bottom" | "left" | "right";
    offsetY: number;
    offsetX: number;
    contentSize: { width: number; height: number };
    containerOffset: { x: number; y: number };
    showArrow: boolean;
    arrowHeight: number;
};

export type UsePopTipPositionReturn = {
    position: { top: number; left: number };
    finalPlacement: "top" | "bottom" | "left" | "right";
    anchorRect: { x: number; y: number; w: number; h: number };
    positionReady: boolean;
    setPositionReady: (value: boolean) => void;
    windowSize: { width: number; height: number };
};

/**
 * PopTip 定位计算 Hook
 *
 * 功能：
 * 1. 测量锚点位置
 * 2. 智能方向切换（空间不足时自动切换）
 * 3. 计算气泡位置（相对于父容器）
 * 4. 防溢出处理（确保气泡不超出屏幕）
 *
 * 计算流程：
 * 1. 检查 visible 状态和内容尺寸是否已测量完成
 * 2. 测量锚点位置（异步）
 * 3. 在异步回调中检查状态和尺寸（防止状态已改变）
 * 4. 计算可用空间，决定最终方向（智能方向切换）
 * 5. 计算气泡位置（相对于父容器）
 * 6. 防溢出处理（确保气泡不超出屏幕）
 * 7. 更新位置和方向状态
 *
 * @param params 定位配置参数
 * @returns 定位相关的状态和值
 */
export const usePopTipPosition = ({
    visible,
    anchorRef,
    placement,
    offsetY,
    offsetX,
    contentSize,
    containerOffset,
    showArrow,
    arrowHeight,
}: UsePopTipPositionParams): UsePopTipPositionReturn => {
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [finalPlacement, setFinalPlacement] = useState(placement);
    const [anchorRect, setAnchorRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const [windowSize, setWindowSize] = useState(Dimensions.get("window"));
    const [positionReady, setPositionReady] = useState(false);

    // ===== 监听屏幕尺寸变化 =====
    useEffect(() => {
        const subscription = Dimensions.addEventListener(
            "change",
            ({ window }) => {
                setWindowSize(window);
            },
        );

        return () => subscription?.remove();
    }, []);

    // ===== 定位计算 + 智能方向切换 + 防溢出 =====
    useEffect(() => {
        if (!visible) {
            return;
        }

        // 如果内容尺寸还没测量出来，不进行计算
        if (contentSize.width === 0 || contentSize.height === 0) {
            setPositionReady(false);
            return;
        }

        setPositionReady(false);

        measureAnchor(anchorRef, (x, y, w, h, px, py) => {
            // 检查状态（异步回调中状态可能已变化）
            if (!visible || w === 0 || h === 0) {
                setPositionReady(false);
                return;
            }

            const { width: cw, height: ch } = contentSize;
            if (cw === 0 || ch === 0) {
                setPositionReady(false);
                return;
            }

            // 转换为相对于PopTip父容器的坐标
            const relativeX = px - containerOffset.x;
            const relativeY = py - containerOffset.y;

            // 记录锚点位置，用于箭头定位
            setAnchorRect((prev) => {
                if (
                    prev.x === relativeX &&
                    prev.y === relativeY &&
                    prev.w === w &&
                    prev.h === h
                ) {
                    return prev;
                }
                return { x: relativeX, y: relativeY, w, h };
            });

            // 计算可用空间，决定最终方向
            const spaceTop = py;
            const spaceBottom = windowSize.height - (py + h);
            const spaceLeft = px;
            const spaceRight = windowSize.width - (px + w);
            const arrowOffset = showArrow ? arrowHeight : 0;

            let nextPlacement = placement;
            if (
                placement === "top" &&
                spaceTop < ch + arrowOffset &&
                spaceBottom > spaceTop
            ) {
                nextPlacement = "bottom";
            } else if (
                placement === "bottom" &&
                spaceBottom < ch + arrowOffset &&
                spaceTop > spaceBottom
            ) {
                nextPlacement = "top";
            } else if (
                placement === "left" &&
                spaceLeft < cw + arrowOffset &&
                spaceRight > spaceLeft
            ) {
                nextPlacement = "right";
            } else if (
                placement === "right" &&
                spaceRight < cw + arrowOffset &&
                spaceLeft > spaceRight
            ) {
                nextPlacement = "left";
            }

            // 计算位置（相对于PopTip父容器）
            let top = 0;
            let left = 0;
            switch (nextPlacement) {
                case "top":
                    top = relativeY - ch - arrowOffset - offsetY;
                    left = relativeX + w / 2 - cw / 2 + offsetX;
                    break;
                case "bottom":
                    top = relativeY + h + arrowOffset + offsetY;
                    left = relativeX + w / 2 - cw / 2 + offsetX;
                    break;
                case "left":
                    top = relativeY + h / 2 - ch / 2 + offsetY;
                    left = relativeX - cw - arrowOffset - offsetX;
                    break;
                case "right":
                    top = relativeY + h / 2 - ch / 2 + offsetY;
                    left = relativeX + w + arrowOffset + offsetX;
                    break;
            }

            // 防溢出处理
            const maxTop = windowSize.height - containerOffset.y - ch - 8;
            const maxLeft = windowSize.width - containerOffset.x - cw - 8;
            top = Math.min(Math.max(top, 8), maxTop);
            left = Math.min(Math.max(left, 8), maxLeft);

            // 最后检查 visible 状态
            if (!visible) {
                setPositionReady(false);
                return;
            }

            // 更新位置和方向
            const roundedTop = Math.round(top);
            const roundedLeft = Math.round(left);
            
            setPosition((prev) => {
                if (
                    Math.round(prev.top) === roundedTop &&
                    Math.round(prev.left) === roundedLeft
                ) {
                    return prev;
                }
                return { top: roundedTop, left: roundedLeft };
            });

            setFinalPlacement((prev) =>
                prev === nextPlacement ? prev : nextPlacement,
            );

            // 统一设置 positionReady
            setPositionReady(true);
        });
    }, [
        visible,
        anchorRef,
        placement,
        offsetY,
        offsetX,
        contentSize.width,
        contentSize.height,
        showArrow,
        arrowHeight,
        windowSize.width,
        windowSize.height,
        containerOffset.x,
        containerOffset.y,
    ]);

    return {
        position,
        finalPlacement,
        anchorRect,
        positionReady,
        setPositionReady,
        windowSize,
    };
};

// ============================================================================
// 箭头样式 Hook
// ============================================================================

export type UsePopTipArrowParams = {
    showArrow: boolean;
    contentSize: { width: number; height: number };
    anchorRect: { x: number; y: number; w: number; h: number };
    position: { top: number; left: number };
    finalPlacement: "top" | "bottom" | "left" | "right";
    borderRadius: number;
    arrowWidth: number;
    arrowHeight: number;
    backgroundColor: string;
};

/**
 * PopTip 箭头样式 Hook
 *
 * 箭头定位逻辑：
 * 1. 计算锚点中心相对于气泡左上角的位置
 * 2. 边界夹紧，避免箭头跑到圆角或超出气泡
 * 3. 根据 finalPlacement 确定箭头位置和方向
 *
 * 使用 useMemo 优化性能，避免每次渲染都重新计算
 *
 * @param params 箭头配置参数
 * @returns 箭头样式对象或 null
 */
export const usePopTipArrow = ({
    showArrow,
    contentSize,
    anchorRect,
    position,
    finalPlacement,
    borderRadius,
    arrowWidth,
    arrowHeight,
    backgroundColor,
}: UsePopTipArrowParams) => {

    return useMemo(() => {
        if (!showArrow || !contentSize.width || !contentSize.height)
            return null;

        const halfArrowW = arrowWidth / 2;
        const base = {
            width: 0,
            height: 0,
            position: "absolute" as const,
            borderStyle: "solid" as const,
        };

        // 锚点中心相对气泡左上角的位置（屏幕坐标差 -> bubble内部坐标）
        const relativeX = anchorRect.x + anchorRect.w / 2 - position.left;
        const relativeY = anchorRect.y + anchorRect.h / 2 - position.top;

        // 边界夹紧，避免箭头跑到圆角或超出气泡
        const minX = borderRadius;
        const maxX = Math.max(
            contentSize.width - arrowWidth - borderRadius,
            minX,
        );
        const leftForArrow = Math.min(
            Math.max(relativeX - halfArrowW, minX),
            maxX,
        );

        const minY = borderRadius;
        const maxY = Math.max(
            contentSize.height - arrowWidth - borderRadius,
            minY,
        );
        const topForArrow = Math.min(
            Math.max(relativeY - halfArrowW, minY),
            maxY,
        );

        switch (finalPlacement) {
            // bubble 在 锚点 上方 -> 箭头在 bubble 底部，朝下(使用 borderTopColor)
            case "top":
                return {
                    ...base,
                    bottom: -arrowHeight,
                    left: leftForArrow,
                    borderLeftWidth: halfArrowW,
                    borderRightWidth: halfArrowW,
                    borderTopWidth: arrowHeight,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderBottomColor: "transparent",
                    borderTopColor: backgroundColor, // 指向锚点
                };

            // bubble 在 锚点 下方 -> 箭头在 bubble 顶部，朝上 (使用 borderBottomColor)
            case "bottom":
                return {
                    ...base,
                    top: -arrowHeight,
                    left: leftForArrow,
                    borderLeftWidth: halfArrowW,
                    borderRightWidth: halfArrowW,
                    borderBottomWidth: arrowHeight,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: "transparent",
                    borderBottomColor: backgroundColor, // 指向锚点
                };

            // bubble 在 锚点 左侧 -> 箭头在 bubble 右侧，朝右 (使用 borderLeftColor)
            case "left":
                return {
                    ...base,
                    right: -arrowHeight,
                    top: topForArrow,
                    borderTopWidth: halfArrowW,
                    borderBottomWidth: halfArrowW,
                    borderLeftWidth: Math.max(0, Number(arrowHeight) || 0),
                    borderTopColor: "transparent",
                    borderBottomColor: "transparent",
                    borderRightColor: "transparent",
                    borderLeftColor: backgroundColor, // 指向锚点
                };

            // bubble 在 锚点 右侧 -> 箭头在 bubble 左侧，朝左 (使用 borderRightColor)
            case "right":
                return {
                    ...base,
                    left: -arrowHeight,
                    top: topForArrow,
                    borderTopWidth: halfArrowW,
                    borderBottomWidth: halfArrowW,
                    borderRightWidth: Math.max(0, Number(arrowHeight) || 0),
                    borderTopColor: "transparent",
                    borderBottomColor: "transparent",
                    borderLeftColor: "transparent",
                    borderRightColor: backgroundColor, // 指向锚点
                };
        }
    }, [
        showArrow,
        contentSize,
        anchorRect,
        position,
        finalPlacement,
        borderRadius,
        arrowWidth,
        arrowHeight,
        backgroundColor,
    ]);
};