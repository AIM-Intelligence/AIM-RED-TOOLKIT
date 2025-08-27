import { useState, useMemo, useLayoutEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import LoadingModal from "../modal/LoadingModal";
import type { NodeData } from "../../types";

export type DefaultNodeType = Node<NodeData>;

/** ===== Layout constants ===== */
const PAD1 = 10;               // 좌/우 패딩 1
const PAD2 = 10;               // 라벨 ↔ 버튼 패딩 2
const BUTTON_WIDTH = 35;       // 세로 버튼 가로 폭
const BORDER_WIDTH = 2;        // tailwind border-2

/** 세로 레이아웃 */
const TOP_BOTTOM_PADDING = 10;    // 노드 위아래 패딩
const PORT_SPACING = 25;          // 포트 간 간격

/** ===== Text metrics (text-xs + font-mono 가정) ===== */
const TEXT_FONT_PX = 12;       // text-xs ~ 12px
const TEXT_LINE_H = 16;        // tailwind 기본 line-height(approx)
const TEXT_DESCENDER_PAD = 2;  // y/g/p 디센더 여유

/** ===== Handle (dot) =====
 * - DOT_RADIUS: 보이는 점 반지름(px)
 * - DOT_DIAM: 보이는 점 지름
 * - HANDLE_HITBOX_DIAM: 클릭 히트박스 지름(필요시 DOT_DIAM보다 크게)
 * - HANDLE_OUTER_OFFSET: 박스 바깥 고정 간격(보이는 점 기준)
 */
const DOT_RADIUS = 3;                           // ★ 점 반지름(px)
const DOT_DIAM = DOT_RADIUS * 2;                // 보이는 점 지름
const HANDLE_HITBOX_DIAM = DOT_DIAM;            // 히트박스(=Handle width/height)
const HANDLE_GAP = 12;                           // 박스 바깥 간격
const HANDLE_OUTER_OFFSET = BORDER_WIDTH + HANDLE_GAP + DOT_DIAM;

/** 라벨/행 높이: 텍스트 기준 + 여유 vs 점 지름 중 더 큰 값 */
const ROW_H = Math.max(TEXT_LINE_H + TEXT_DESCENDER_PAD, DOT_DIAM);

export default function DefaultNode(props: NodeProps & { data: NodeData }) {
  const [hovering, setHovering] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    status: "loading" | "success" | "error";
    message: string;
    resultData?: unknown;
  }>({
    isOpen: false,
    status: "loading",
    message: "",
    resultData: undefined,
  });

  /** 실제 폰트 폭으로 라벨 너비 측정 (text-xs + font-mono 기준) */
  const [inW, setInW] = useState(0);
  const [outW, setOutW] = useState(0);

  useLayoutEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const font =
      `${TEXT_FONT_PX}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    const measure = (t: string) => {
      if (!ctx) return Math.ceil(t.length * 7);
      ctx.font = font;
      return Math.ceil(ctx.measureText(t).width) + 2; // 안전 마진
    };

    if (props.data.inputs?.length) {
      setInW(Math.max(30, ...props.data.inputs.map(i => measure(i.label))));
    } else setInW(0);

    if (props.data.outputs?.length) {
      setOutW(Math.max(30, ...props.data.outputs.map(o => measure(o.label))));
    } else setOutW(0);
  }, [props.data.inputs, props.data.outputs]);

  /** 콘텐츠 가로폭: PAD1 + inW + PAD2 + BUTTON + PAD2 + outW + PAD1 */
  const contentWidth = useMemo(() => {
    return PAD1 + inW + PAD2 + BUTTON_WIDTH + PAD2 + outW + PAD1;
  }, [inW, outW]);

  /** 노드 가로폭 = 콘텐츠폭 + 좌우 보더 */
  const nodeWidth = useMemo(() => {
    return contentWidth + 2 * BORDER_WIDTH;
  }, [contentWidth]);

  /** 세로 높이 계산(포트 개수에 맞춰) */
  const nodeHeight = useMemo(() => {
    const ic = props.data.inputs?.length || 0;
    const oc = props.data.outputs?.length || 0;
    const n = Math.max(ic, oc, 1);
    // 포트 개수 × 간격 + 위아래 패딩
    const portsHeight = n * PORT_SPACING;
    const innerContentH = TOP_BOTTOM_PADDING * 2 + portsHeight;
    return innerContentH + 2 * BORDER_WIDTH;
  }, [props.data.inputs, props.data.outputs]);

  /** 포트 Y 중심(노드 컨테이너 기준, BORDER 포함 좌표계) */
  const getPortCenterY = (index: number, total: number) => {
    const contentTop = BORDER_WIDTH + TOP_BOTTOM_PADDING;
    if (total <= 1) {
      // 포트가 1개일 때는 중앙에
      const innerH = nodeHeight - 2 * BORDER_WIDTH;
      return Math.round(BORDER_WIDTH + innerH / 2);
    }
    // 여러 개일 때는 균등 배치
    const spacing = PORT_SPACING;
    const startY = contentTop + spacing / 2;
    return Math.round(startY + index * spacing);
  };

  const handleNodeClick = () => props.data.viewCode?.();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  /** 콘텐츠 래퍼 내부 좌표 */
  const inputBoxLeft = PAD1;
  const buttonCenterLeft = PAD1 + inW + PAD2 + BUTTON_WIDTH / 2;
  const outputBoxLeft = PAD1 + inW + PAD2 + BUTTON_WIDTH + PAD2;

  return (
    <>
      <LoadingModal
        isOpen={modalState.isOpen}
        status={modalState.status}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        notice={{
          loading: modalState.message,
          success:
            modalState.status === "success"
              ? `${modalState.message}\n\nOutput:\n${String(modalState.resultData)}`
              : modalState.message,
          error: modalState.message,
          errorDetails:
            modalState.status === "error" && modalState.resultData
              ? String(modalState.resultData)
              : undefined,
        }}
      />

      <div
        className={clsx(
          "bg-black rounded-lg border-2 border-neutral-500 relative box-border",
          hovering && "border-red-400 shadow-lg"
        )}
        style={{
          width: `${nodeWidth}px`,
          height: `${nodeHeight}px`,
          overflow: "visible", // 핸들이 밖으로 나와도 보이도록
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* 삭제 버튼 */}
        {hovering && (
          <button
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
          >
            ✕
          </button>
        )}

        {/* ===== 가로 중앙 정렬된 콘텐츠 래퍼 ===== */}
        <div
          className="absolute inset-y-0"
          style={{
            width: `${contentWidth}px`,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {/* ===== 입력 라벨/핸들 ===== */}
          {props.data.inputs?.length ? (
            <div
              className="absolute"
              style={{
                left: `${inputBoxLeft}px`,
                width: `${inW}px`,
                top: 0,
                bottom: 0,
              }}
            >
              {props.data.inputs.map((input, idx) => {
                const cy = getPortCenterY(idx, props.data.inputs!.length); // 중심 Y
                return (
                  <div key={`in-row-${input.id}`}>
                    {/* 라벨 행 */}
                    <div
                      className="absolute"
                      style={{
                        left: 0,
                        right: 0,
                        top: `${cy}px`,
                        transform: "translateY(-50%)",
                        height: `${ROW_H}px`,
                      }}
                    >
                      <div
                        className="h-full flex items-center justify-end text-xs text-neutral-300 font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ lineHeight: `${TEXT_LINE_H}px` }}
                      >
                        {input.label}
                      </div>
                    </div>

                    {/* 핸들(점) */}
                    <Handle
                      key={`h-in-${input.id}`}
                      type="target"
                      position={Position.Left}
                      id={input.id}
                      style={{
                        left: -HANDLE_OUTER_OFFSET,
                        top: `${cy}px`,
                        transform: "translateY(-50%)",
                        width: `${HANDLE_HITBOX_DIAM}px`,
                        height: `${HANDLE_HITBOX_DIAM}px`,
                        borderRadius: "9999px",
                      }}
                      title={`${input.label} (${input.type})${input.required ? " *" : ""}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* 가운데 세로 버튼 */}
          <button
            className="absolute text-xs bg-red-800 text-white px-1 py-2 rounded hover:bg-red-900 transition-colors hover:cursor-pointer"
            style={{
              writingMode: "vertical-rl",
              width: `${BUTTON_WIDTH}px`,
              minHeight: "60px",
              left: `${buttonCenterLeft}px`,
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleNodeClick();
            }}
          >
            {props.data.title || "Node"}
          </button>

          {/* ===== 출력 라벨/핸들 ===== */}
          {props.data.outputs?.length ? (
            <div
              className="absolute"
              style={{
                left: `${outputBoxLeft}px`,
                width: `${outW}px`,
                top: 0,
                bottom: 0,
              }}
            >
              {props.data.outputs.map((output, idx) => {
                const cy = getPortCenterY(idx, props.data.outputs!.length);
                return (
                  <div key={`out-row-${output.id}`}>
                    <div
                      className="absolute"
                      style={{
                        left: 0,
                        right: 0,
                        top: `${cy}px`,
                        transform: "translateY(-50%)",
                        height: `${ROW_H}px`,
                      }}
                    >
                      <div
                        className="h-full flex items-center justify-start text-xs text-neutral-300 font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ lineHeight: `${TEXT_LINE_H}px` }}
                      >
                        {output.label}
                      </div>
                    </div>

                    <Handle
                      key={`h-out-${output.id}`}
                      type="source"
                      position={Position.Right}
                      id={output.id}
                      style={{
                        right: -HANDLE_OUTER_OFFSET,
                        top: `${cy}px`,
                        transform: "translateY(-50%)",
                        width: `${HANDLE_HITBOX_DIAM}px`,
                        height: `${HANDLE_HITBOX_DIAM}px`,
                        borderRadius: "9999px",
                      }}
                      title={`${output.label} (${output.type})`}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ====== 입력/출력 포트가 0개일 때 중앙 핸들 ====== */}
        {!props.data.inputs?.length && (
          <Handle
            type="target"
            position={Position.Left}
            style={{
              left: -HANDLE_OUTER_OFFSET,
              top: "50%",
              transform: "translateY(-50%)",
              width: `${HANDLE_HITBOX_DIAM}px`,
              height: `${HANDLE_HITBOX_DIAM}px`,
              borderRadius: "9999px",
            }}
          />
        )}

        {!props.data.outputs?.length && (
          <Handle
            type="source"
            position={Position.Right}
            style={{
              right: -HANDLE_OUTER_OFFSET,
              top: "50%",
              transform: "translateY(-50%)",
              width: `${HANDLE_HITBOX_DIAM}px`,
              height: `${HANDLE_HITBOX_DIAM}px`,
              borderRadius: "9999px",
            }}
          />
        )}
      </div>
    </>
  );
}