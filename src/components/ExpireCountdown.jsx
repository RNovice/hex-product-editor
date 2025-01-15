import { useState, useEffect } from "react";

const ExpireCountdown = ({ expireTime }) => {
  const [countdownStr, setCountdownStr] = useState("");

  useEffect(() => {
    function updateCountdown() {
      let difference = new Date(expireTime) - Date.now();
      if (difference <= 0) return setCountdownStr("0 秒");

      const timeUnits = [
        ["天", 1000 * 60 * 60 * 24],
        ["小時", 1000 * 60 * 60],
        ["分", 1000 * 60],
        ["秒", 1000],
      ];

      setCountdownStr(
        timeUnits
          .map(([unit, ms]) => {
            const value = Math.floor(difference / ms);
            difference %= ms;
            return value > 0 ? `${value} ${unit}` : "";
          })
          .join(" ")
          .trim()
      );
    }

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [expireTime]);

  return <p className="text-secondary">距離登入過期還剩： {countdownStr}</p>;
};

export default ExpireCountdown;
