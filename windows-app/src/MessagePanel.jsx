import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import noteData from "./data/note/FwOTs4UxQS4.json";
import audioPlaybackService from "./services/audioPlaybackService";

const MessagePanel = forwardRef(({ onClose }, ref) => {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const [shownTimes, setShownTimes] = useState([]);
  const shownTimesRef = useRef([]);
  const closedRef = useRef(false);

  // 保持 shownTimesRef 為最新
  useEffect(() => {
    shownTimesRef.current = shownTimes;
  }, [shownTimes]);

  useImperativeHandle(ref, () => ({
    handleTest,
  }));

  // 自動根據 timestamp 顯示
  useEffect(() => {
    closedRef.current = false;
    const interval = setInterval(() => {
      if (closedRef.current) return;
      const currentTime = audioPlaybackService.getCurrentTime?.();
      if (typeof currentTime !== "number") return;
      const matched = noteData.find(
        (item) =>
          typeof item.time === "number" &&
          Math.abs(item.time - currentTime) < 1000 &&
          !shownTimesRef.current.includes(item.time)
      );
      if (matched) {
        console.log("currentTime", currentTime, "matched:", matched.Keyword);
        setMessage(matched.Keyword);
        setShow(true);
        setShownTimes((prev) => [...prev, matched.time]);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // 讓外部可呼叫
  const handleTest = () => {
    const next = noteData.find(
      (item) => typeof item.time === "number" && !shownTimesRef.current.includes(item.time)
    );
    if (next) {
      console.log("顯示下一個 Keyword:", next.Keyword, next.time);
      setMessage(next.Keyword);
      setShow(true);
      setShownTimes((prev) => [...prev, next.time]);
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleTest();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleClose = () => {
    setShow(false);
    closedRef.current = true;
    if (onClose) onClose();
  };

  if (!show) {
    return null;
  }

  return (
    <div
      className="fixed top-1/4 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 rounded-xl p-6 shadow-lg z-50"
      style={{
        minWidth: 240,
        color: "#fff",
        position: "fixed",
        top: "25%",
        left: "50%",
        transform: "translate(-50%, 0)",
        background: "rgba(0,0,0,0.85)",
        borderRadius: 16,
        padding: 24,
        zIndex: 9999,
        boxShadow: "0 4px 24px #0008",
      }}
    >
      <button
        onClick={handleClose}
        style={{
          position: "absolute",
          right: 16,
          top: 12,
          background: "none",
          border: "none",
          fontSize: 22,
          color: "#fff",
          cursor: "pointer",
        }}
        title="關閉"
      >
        ❌
      </button>
      <div style={{ fontSize: 22, textAlign: "center", marginTop: 16 }}>
        {message}
      </div>
    </div>
  );
});

export default MessagePanel;