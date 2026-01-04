import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { usePopTipAnimation, usePopTipArrow, usePopTipClose, usePopTipPosition } from "./PopTipHooks";

/**
 * @author lucky-ricardo
 * @file-overview
 *
 * 通用提示气泡组件：只处理通用能力，方便使用，放权给使用者自定义内容
 * 关于命名：Omni- 前缀（拉丁语 "全能、全部"），OmniBubble寄望其成为一个通用全能好像的组件
 *
 * 核心功能
 * 1. 内容自定义 - 通过 renderContent 完全自定义气泡内容
 * 2. 任意组件作为锚点（尽量使用具体组件或虚拟组件作为锚点，
 *    不用容器尤其是absolute：（在这种场景需要获取动态容器高度）
 *    当父容器内的所有子元素都是 absolute 定位时：
 *    1.这些子元素脱离了正常文档流
 *    2.不会撑起父容器的高度
 *    3.父容器的高度计算为 0）
 *
 * 3. 自动智能定位 - 锚点位置变化时自动调整气泡位置
 * 4. 智能方向切换 - 空间不足时自动切换方向（top/bottom/left/right）
 * 5. 支持点击/滑动关闭 - 使用useCloseAllPopTips详见PopTipHooks
 * 6. 屏幕防溢出 - 自动防止气泡超出屏幕边界
 * 7. 可配置箭头显隐，方向，大小（等边/等腰）
 * 8. 可配置自动消失时间 - 如不配置则不自动消失
 * 9. 支持 x/y 偏移量 - 微调气泡位置
 * 10. 支持多种动画类型 - fade（默认）/slideUp/slideDown/slideLeft/slideRight
 *
 * @date 2025/11/06
 */
export type Theme = {
    backgroundColor?: string; // 气泡背景色
    borderRadius?: number; // 圆角大小
    shadowColor?: string; // 阴影颜色（iOS）
    shadowOpacity?: number; // 阴影透明度（iOS）
    shadowRadius?: number; // 阴影半径（iOS）
    elevation?: number; // 阴影高度（Android）
    arrowHeight?: number; // 三角形的高度（延伸距离）
    arrowWidth?: number; // 三角形的底边宽度
};

export type AnimationType =
    | "fade"
    | "slideUp"
    | "slideDown"
    | "slideLeft"
    | "slideRight";

export type AnimationConfig = {
    type?: AnimationType; // 动画类型，默认 'fade'
    slideDistance?: number; // 滑动距离（仅用于 slide 类型），默认 30
    duration?: number; // 动画时长，默认 300ms
    showDuration?: number; // 显示动画时长，默认 250ms
    hideDuration?: number; // 隐藏动画时长，默认 200ms
};

export type PopTipProps = {
    visible: boolean; // 气泡显示与否（受控属性）
    anchorRef: React.RefObject<View>; // 任意锚点组件的引用（按钮、文字、图片等）
    placement: "top" | "bottom" | "left" | "right"; // 气泡位置相对于锚点的位置（首选方向）
    offsetY?: number; // 气泡垂直方向偏移量
    offsetX?: number; // 气泡水平方向偏移量
    theme?: Theme; // 气泡主题样式
    showArrow?: boolean; // 可配置是否显示三角箭头
    renderContent: () => React.ReactNode; // 渲染气泡内容的函数
    onClose?: () => void; // 气泡关闭回调
    duration?: number; // 配置自动消失时间（毫秒），如不配置则不自动消失
    containerRef?: React.RefObject<View>; // 可选：指定父容器ref，用于计算相对位置
    animationConfig?: AnimationConfig; // 动画配置
};

export const OmniBubble: React.FC<PopTipProps> = ({
    visible,
    anchorRef,
    placement,
    offsetY = 0,
    offsetX = 0,
    theme,
    showArrow = true,
    renderContent,
    onClose,
    duration,
    containerRef,
    animationConfig,
}) => {
    // 内部实际渲染状态
    const [inShouldMount, setInShouldMount] = useState(false);
    // 控制动画的 visible 状态
    const [inVisible, setInVisible] = useState(false);
    // 记录 onClose 被调用的时间戳
    const onCloseTimeRef = useRef<number | null>(null);

    // 处理 onClose，记录时间
    const handleClose = useCallback(() => {
        onCloseTimeRef.current = Date.now();
        onClose?.();
    }, [onClose]);

    useEffect(() => {
        const hideDuration = animationConfig?.hideDuration || animationConfig?.duration || 200;
        if (visible) {
            // visible 变为 true
            if (inShouldMount && onCloseTimeRef.current !== null) {
                // 正在关闭中，计算剩余时间
                const elapsed = Date.now() - onCloseTimeRef.current;
                const remaining = Math.max(0, hideDuration - elapsed);

                setTimeout(() => {
                    onCloseTimeRef.current = null;
                    setInShouldMount(visible);
                    setInVisible(visible);
                }, remaining);
                return;
            }
            // 不在关闭中，立即挂载并显示
            setInShouldMount(visible);
            setInVisible(visible);
        } else {
            // visible 变为 false
            setTimeout(() => {
                setInShouldMount(visible);
            }, hideDuration);
            setInVisible(visible);
        }
    }, [visible, inShouldMount, animationConfig?.hideDuration, animationConfig?.duration]);

    return inShouldMount ? (
        <PopTip
            visible={inVisible}
            anchorRef={anchorRef}
            placement={placement}
            offsetY={offsetY}
            offsetX={offsetX}
            theme={theme}
            showArrow={showArrow}
            renderContent={renderContent}
            onClose={handleClose}
            duration={duration}
            containerRef={containerRef}
            animationConfig={animationConfig}
        />
    ) : null;
}

const PopTip: React.FC<PopTipProps> = ({
    visible,
    anchorRef,
    placement,
    offsetY = 0,
    offsetX = 0,
    theme,
    showArrow = true,
    renderContent,
    onClose,
    duration,
    containerRef,
    animationConfig,
}) => {
    // ===== 所有 Hooks 必须在最顶层，在任何条件返回之前 =====

    // ===== 状态管理 =====
    const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
    const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });
    const [containerLayoutReady, setContainerLayoutReady] = useState(false);

    // ===== 引用管理 =====
    const popTipContainerRef = useRef<View>(null);
    const onCloseRef = useRef(onClose);

    // ===== 主题配置 =====
    const {
        backgroundColor = "#E2ECFF",
        borderRadius = 8,
        arrowHeight = 6,
        arrowWidth = 10,
        shadowColor,
        shadowOpacity,
        shadowRadius,
        elevation,
    } = theme || {};

    // ===== 动画配置 =====
    const animType = (animationConfig?.type || "fade") as AnimationType;
    const slideDistance = animationConfig?.slideDistance || 30;
    const showDuration =
        animationConfig?.showDuration || animationConfig?.duration || 250;
    const hideDuration =
        animationConfig?.hideDuration || animationConfig?.duration || 200;

    // ===== 保持 onCloseRef 最新 =====
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // ===== 注册关闭监听（支持全局关闭所有PopTip） =====
    usePopTipClose(() => {
        onCloseRef.current?.();
    }, visible);

    // 核心修复：当 visible 变为 false 时，重置 containerLayoutReady
    // 确保下次显示时重新测量容器布局
    useEffect(() => {
        if (!visible) {
            setContainerLayoutReady(false);
        }
    }, [visible]);

    // ===== 自动关闭逻辑 =====
    useEffect(() => {
        if (!visible || !duration) return;

        const timer = setTimeout(() => {
            onCloseRef.current?.();
        }, duration);

        return () => {
            clearTimeout(timer);
        };
    }, [visible, duration]);

    // ===== 测量父容器位置（用于坐标转换） =====
    const actualContainerRef = containerRef || popTipContainerRef;
    useEffect(() => {
        if (!visible || !containerLayoutReady) {
            setContainerOffset({ x: 0, y: 0 });
            return;
        }

        const refToMeasure = actualContainerRef?.current;

        if (!refToMeasure) {
            setContainerOffset({ x: 0, y: 0 });
            return;
        }

        // 测量父容器在窗口中的位置
        if (refToMeasure.measureInWindow) {
            refToMeasure.measureInWindow((x, y) => {
                setContainerOffset({ x, y });
            });
        } else {
            // 兼容旧版本API
            refToMeasure.measure((pageX, pageY) => {
                setContainerOffset({ x: pageX, y: pageY });
            });
        }
    }, [visible, containerLayoutReady, actualContainerRef]);

    // ===== 定位计算 Hook =====
    const {
        position,
        finalPlacement,
        anchorRect,
        positionReady,
    } = usePopTipPosition({
        visible,
        anchorRef,
        placement,
        offsetY,
        offsetX,
        contentSize,
        containerOffset,
        showArrow,
        arrowHeight,
    });

    // ===== 动画控制 Hook =====
    const { shouldRender, opacity, transform } = usePopTipAnimation({
        visible,
        contentSize,
        positionReady,
        animType,
        slideDistance,
        showDuration,
        hideDuration,
    });

    // ===== 箭头样式 Hook =====
    const calculatedArrowStyle = usePopTipArrow({
        showArrow,
        contentSize,
        anchorRect,
        position,
        finalPlacement,
        borderRadius,
        arrowWidth,
        arrowHeight,
        backgroundColor,
    });

    // ===== 所有 Hooks 调用完毕，现在可以条件返回 =====

    if (!shouldRender) return null;

    /**
     * 内容布局监听
     * 当内容尺寸变化时，更新 contentSize 状态，触发定位重新计算
     * 同时标记容器布局已就绪（因为内容布局完成时，容器布局肯定也完成了）
     */
    const onContentLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;

        setContentSize({ width, height });

        // 核心优化：当内容布局完成时，容器布局也肯定完成了
        // 这样可以减少一次布局事件触发，并且确保状态同步
        if (!containerLayoutReady) {
            setContainerLayoutReady(true);
        }
    };

    return (
        <Animated.View
            ref={popTipContainerRef}
            style={[
                styles.container,
                {
                    top: position.top,
                    left: position.left,
                    opacity,
                    transform: transform.length > 0 ? transform : undefined,
                    zIndex: 9999,
                },
            ]}
            pointerEvents="box-none"
        >
            {/* 气泡主体：设置主题样式 */}
            <Pressable
                onPress={() => {
                    // 点击PopTip时关闭
                    onCloseRef.current?.();
                }}
                style={{
                    backgroundColor,
                    borderRadius,
                    shadowColor,
                    shadowOpacity,
                    shadowRadius,
                    elevation,
                }}
            >
                {/* 内容容器：用于测量实际内容尺寸 */}
                <View
                    onLayout={onContentLayout}
                    // 内容区域不阻止事件，让Pressable处理点击事件
                >
                    {/* 气泡内容：图文等复杂布局自行定制 */}
                    {renderContent()}
                    {/* 箭头：根据 finalPlacement 显示在对应位置 */}
                    {showArrow && calculatedArrowStyle && (
                        <View style={calculatedArrowStyle} />
                    )}
                </View>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: { position: 'absolute'},
});