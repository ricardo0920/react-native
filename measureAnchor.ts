import { findNodeHandle, UIManager, View } from "react-native";
import React from "react";

/**
 * 测量锚点位置
 *
 * 测量策略（按优先级）：
 * 1. 优先使用 measureInWindow（直接获取window坐标，最准确）
 * 2. 回退到 measure（兼容旧版本）
 * 3. 最后尝试 UIManager.measure（兜底方案）
 *
 * 返回值说明：
 * - x, y: 锚点相对于父容器的坐标（用于定位计算）
 * - w, h: 锚点的宽度和高度
 * - pageX, pageY: 锚点在窗口中的坐标（用于空间判断和方向切换）
 *
 * @param anchorRef 锚点组件的引用
 * @param callback 测量完成后的回调函数
 */
export const measureAnchor = (
    anchorRef: React.RefObject<View>,
    callback: (
        x: number,
        y: number,
        w: number,
        h: number,
        pageX: number,
        pageY: number,
    ) => void,
) => {
    if (!anchorRef.current) {
        console.log("PopTip: anchorRef.current is null");
        return;
    }

    // 优先使用measureInWindow（直接获取window坐标）
    if (anchorRef.current.measureInWindow) {
        anchorRef.current.measureInWindow((x, y, w, h) => {
            if (w > 0 && h > 0) {
                // measureInWindow返回的就是window坐标
                callback(x, y, w, h, x, y);
            } else {
                // 回退到measure
                anchorRef.current?.measure((_x, _y, _w, _h, _px, _py) => {
                    if (_w > 0 && _h > 0) {
                        callback(_px, _py, _w, _h, _px, _py);
                    }
                });
            }
        });
    } else {
        // 兼容：使用measure
        anchorRef.current.measure((x, y, w, h, pageX, pageY) => {
            if (w > 0 && h > 0) {
                // 使用window坐标（pageX, pageY）
                callback(pageX, pageY, w, h, pageX, pageY);
            } else {
                // 尝试UIManager（兜底方案）
                const node = findNodeHandle(anchorRef.current);
                if (node) {
                    UIManager.measure(node, (_x, _y, _w, _h, _px, _py) => {
                        if (_w > 0 && _h > 0) {
                            callback(_px, _py, _w, _h, _px, _py);
                        }
                    });
                }
            }
        });
    }
};



