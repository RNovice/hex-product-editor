import React, { useState, useEffect } from "react";
import axios from "axios";
import CryptoJS from "crypto-js";
import Editor from "@monaco-editor/react";
import maximizeSvg from "./assets/maximize.svg";
import minimizeSvg from "./assets/minimize.svg";
import oneColSvg from "./assets/oneCol.svg";
import threeColSvg from "./assets/threeCol.svg";

import "./App.css";
import ExpireCountdown from "./components/ExpireCountdown";

const { VITE_API_BASE: API_BASE, VITE_SECRET_KEY: SECRET_KEY } = import.meta
  .env;
const saveLocalWarning = "如果你的帳號密碼與其他平台通用的話不建議使用";

/*
https://hexschool.github.io/ec-courses-api-swaggerDoc/
*/
const App = () => {
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [expireTime, setExpireTime] = useState(null);
  const [userAcct, setUserAcct] = useState({
    username: "",
    password: "",
  });
  const [API_Path, setAPI_Path] = useState("");
  const [products, setProducts] = useState([]);
  const [viewEditProduct, setViewEditProduct] = useState({});
  const [json, setJson] = useState(null);
  const [editMode, setEditMode] = useState(true);
  const [fullWho, setFullWho] = useState(null);
  const [isMoreImg3Col, setIsMoreImg3Col] = useState(false);
  const [operationLog, setOperationLog] = useState([]);
  const [logKey, setLogKey] = useState(0);

  useEffect(() => {
    async function checkLogin() {
      setIsCheckingLogin(true);
      try {
        logOperation({msg:'檢查登入狀態'})
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("productEditorAuthToken="))
          ?.split("=")[1];
        if (token === undefined) return;
        axios.defaults.headers.common.Authorization = token;
        const {
          data: { success },
        } = await axios.post(`${API_BASE}/api/user/check`);
        setIsLogin(success);
        if (success) {
          setExpireTime(+localStorage.getItem("authExpire"));
          logOperation({msg:'已登入'})
        }
      } catch (err) {
        console.error(err);
        logOperation({msg:'請重新登入', type: 'log-warning'})
      } finally {
        setIsCheckingLogin(false);
      }
    }
    checkLogin();
  }, []);

  useEffect(() => {
    const userInfo = localStorage.getItem("ui");
    const decrypt = (data) =>
      CryptoJS.AES.decrypt(data, SECRET_KEY).toString(CryptoJS.enc.Utf8);
    if (userInfo) {
      const { pa, nu, wp } = JSON.parse(userInfo);
      setUserAcct({
        username: nu ? decrypt(nu) : "",
        password: wp ? decrypt(wp) : "",
      });
      setAPI_Path(pa ? pa : "");
    }
  }, []);

  useEffect(() => {
    function handleCloseFullscreen(e) {
      if (e.key === "Escape") setFullWho(null);
    }
    window.addEventListener("keydown", handleCloseFullscreen);

    return () => {
      window.removeEventListener("keydown", handleCloseFullscreen);
    };
  }, []);

  useEffect(() => {
    if (isLogin) getProducts();
  }, [isLogin]);

  useEffect(() => setLogKey(logKey + 1), [operationLog]);

  function handleLoginInput(e) {
    const { name, value } = e.target;
    setUserAcct((pre) => ({
      ...pre,
      [name]: value,
    }));
  }

  function handlePathInput(e) {
    setAPI_Path(e.target.value);
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();

    try {
      const res = await axios.post(`${API_BASE}/admin/signin`, userAcct);
      const { token, expired } = res.data;
      document.cookie = `productEditorAuthToken=${token};expires=${new Date(
        expired
      )};`;
      axios.defaults.headers.common.Authorization = token;
      localStorage.setItem("authExpire", expired);
      setExpireTime(expired);
      setIsLogin(true);
      logOperation({ msg: "登入成功", type: "log-success" });
    } catch (err) {
      console.error(err);
      logOperation({ msg: "登入失敗", type: "log-err" });
    }
  }

  async function handleLogout(e) {
    e.preventDefault();

    try {
      const { status } = await axios.post(`${API_BASE}/logout`);
      if (status === 200) {
        document.cookie =
          "productEditorAuthToken; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        setIsLogin(false);
        setExpireTime(null);
        logOperation({ msg: "登出成功" });
      }
    } catch (err) {
      console.error(err);
      logOperation({ msg: "登出失敗", type: "log-err" });
    }
  }

  function handleSaveUserInfo() {
    if (
      !localStorage.getItem("ui") &&
      !confirm(saveLocalWarning + "\n此警告僅於新建儲存資料時出現\n確定儲存?")
    )
      return;
    const { username, password } = userAcct;
    if ([username, password, API_Path].every((e) => !e))
      return localStorage.removeItem("ui");
    const encrypt = (text) => CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    localStorage.setItem(
      "ui",
      JSON.stringify({
        pa: API_Path || undefined,
        nu: username ? encrypt(username) : undefined,
        wp: password ? encrypt(password) : undefined,
      })
    );
  }

  function handleEditorChange(newValue) {
    setJson(newValue);
  }

  function handleFullscreen(e, target) {
    e.target.focus();
    setFullWho(target === fullWho ? null : target);
  }

  async function getProducts() {
    try {
      const res = await axios.get(
        `${API_BASE}/api/${API_Path}/admin/products/all`
      );
      const allProducts = Object.values(res.data.products);
      setProducts(allProducts);
      setJson(JSON.stringify(allProducts, null, "\t"));
    } catch (err) {
      console.error(err);
    }
  }

  function logOperation({ msg, type = "" }) {
    const now = new Date();
    const HH = now.getHours().toString().padStart(2, "0");
    const MM = now.getMinutes().toString().padStart(2, "0");
    const SS = now.getSeconds().toString().padStart(2, "0");
    setOperationLog((pre) => [{ msg: `${HH}:${MM}:${SS} | ${msg}`, type }, ...pre]);
  }

  return (
    <div className="container-fluid text-light" style={{ height: "100vh" }}>
      <div className="row p-3 h-100 gap-1">
        <aside
          className="col-auto d-flex flex-column h-100 bg-dark"
          style={{ width: "calc(230px + (80px + .8rem) + .8rem * 4)" }}
        >
          <div className="flex-grow-1 overflow-auto pe-3">
            <ul className="list-group">
              {products.map((product, i) => (
                <li
                  key={`aside-product-li-${i}`}
                  className="list-group-item bg-dark text-light aside-product-li"
                  onClick={() => setViewEditProduct(product)}
                >
                  {product?.title || "找不到產品名稱"}
                </li>
              ))}
            </ul>
          </div>
          <div className="py-3 user-info">
            {expireTime && isLogin ? (
              <ExpireCountdown expireTime={expireTime} />
            ) : (
              <p className="text-secondary">登入狀態：尚未登入</p>
            )}
            <form
              className="login-form"
              onSubmit={isLogin ? handleLogout : handleLoginSubmit}
            >
              <div className="form-floating mb-3">
                <input
                  type="email"
                  id="username"
                  name="username"
                  className="form-control bg-dark text-light"
                  placeholder="name@example.com"
                  value={userAcct.username}
                  required
                  onInput={handleLoginInput}
                />
                <label htmlFor="username" className="text-light">
                  Email address
                </label>
              </div>
              <button
                className={`btn btn-${
                  isCheckingLogin
                    ? "checking-login"
                    : isLogin
                    ? "success btn-lg"
                    : "secondary btn-lg"
                } w-100`}
                type="submit"
                tabIndex={-1}
              >
                {isCheckingLogin ? (
                  <>
                    登入
                    <br />
                    檢查中
                  </>
                ) : isLogin ? (
                  "登出"
                ) : (
                  "登入"
                )}
              </button>
              <div className="form-floating">
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-control bg-dark text-light"
                  placeholder="Password"
                  value={userAcct.password}
                  required
                  onInput={handleLoginInput}
                />
                <label htmlFor="password" className="text-light">
                  Password
                </label>
              </div>
              <div className="form-floating">
                <input
                  type="text"
                  id="api-path"
                  className="form-control bg-dark text-light"
                  placeholder="API-Path"
                  value={API_Path}
                  onInput={handlePathInput}
                />
                <label htmlFor="api-path" className="text-light">
                  API 路徑
                </label>
              </div>
              <div className="save-local">
                <button
                  className="btn btn-success w-100 h-100"
                  type="button"
                  onClick={handleSaveUserInfo}
                >
                  存到本地
                </button>
                <button
                  type="button"
                  className="save-local-info"
                  onClick={() =>
                    alert(
                      `【 localStorage 】\n將帳密與API路徑存到本地\n避免 重開/整 時需要重新填寫\n帳號密碼部分會經過簡單加密\n全部留白時儲存會自動刪除資料\n可選想儲存的資料,留白的欄位不會被儲存\n` +
                        saveLocalWarning
                    )
                  }
                >
                  &#9432;
                </button>
              </div>
            </form>
          </div>
        </aside>
        <main className="col bg-dark d-flex px-0 h-100">
          <div className="col-md-8 bg-dark d-flex flex-column">
            <div className="row flex-grow-1 mx-0">
              <Editor
                height="calc(100% - 1rem)"
                theme="vs-dark"
                defaultLanguage="json"
                value={json}
                onChange={handleEditorChange}
                options={{
                  folding: true,
                  foldingHighlight: true,
                  wordWrap: "on",
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            </div>
            <div className="row bg-dark mx-0" style={{ height: "150px" }}>
              <div className="col-md-7 p-3">
                <button className="btn btn-success me-2">Create</button>
                <button className="btn btn-warning me-2">Edit</button>
                <button className="btn btn-danger">Delete</button>
              </div>
              <div className="col-md-5 bg-log overflow-auto h-100 rounded p-0 position-relative">
                <h6 className="mb-1 position-sticky sticky-top border-bottom log-title">
                  系統日誌
                </h6>
                <ul className="list-group">
                  {operationLog.map((log, i) => (
                    <li
                      key={`log-message-${i === 0 ? `new-log-${logKey}` : i}`}
                      className={`list-group-item border-0 log-msg ${
                        log?.type
                      } ${i === 0 ? "log-new" : ""}`}
                    >
                      {log.msg}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="col-md-4 bg-dark ps-3 pe-2 overflow-auto">
            <div className="card bg-dark text-light border-0">
              <button
                type="button"
                title="click to show original ratio"
                className={`ratio ratio-16x9 ${
                  fullWho === "product-main-img" ? "full-screen" : ""
                }`}
              >
                {viewEditProduct.imageUrl && (
                  <>
                    <i
                      style={{
                        maskImage: `url("${
                          fullWho === "product-main-img"
                            ? minimizeSvg
                            : maximizeSvg
                        }")`,
                      }}
                      className="full-screen-btn icon"
                      tabIndex={0}
                      onClick={(e) => handleFullscreen(e, "product-main-img")}
                    />
                    <img
                      src={viewEditProduct.imageUrl}
                      alt={viewEditProduct.title || "主要圖片"}
                      className="rounded"
                    />
                  </>
                )}
              </button>
              <div className="card-body px-0 d-flex flex-column gap-2">
                <h5 className="card-title">
                  <span className="text-secondary">標題：</span>
                  {viewEditProduct.title}
                </h5>
                <div className="d-flex gap-3">
                  <p className="card-subtitle mb-2">
                    <span className="text-secondary">分類：</span>
                    {viewEditProduct.category}
                  </p>
                  <p className="card-text">
                    <span className="text-secondary">是否啟用：</span>
                    {viewEditProduct.is_enabled !== undefined
                      ? viewEditProduct.is_enabled
                        ? "已啟用"
                        : "未啟用"
                      : "找不到欄位"}
                  </p>
                </div>
                <div className="d-flex gap-3">
                  <p className="card-text">
                    <span className="text-secondary">原價：</span>
                    {viewEditProduct.origin_price}
                  </p>
                  <p className="card-text">
                    <span className="text-secondary">售價：</span>
                    {viewEditProduct.price}
                  </p>
                  <p className="card-text">
                    <span className="text-secondary">單位：</span>
                    {viewEditProduct.unit}
                  </p>
                </div>
                <p className="card-text">
                  <span className="text-secondary">描述：</span>
                  <br />
                  <br />
                  {viewEditProduct.description}
                </p>
                <p className="card-text">
                  <span className="text-secondary">說明：</span>
                  <br />
                  <br />
                  {viewEditProduct.content}
                </p>
              </div>
              <div className="card-body px-0">
                <h6>
                  <span className="text-secondary">更多圖片:</span>

                  <button
                    className="more-pic-layout-btn"
                    type="button"
                    onClick={() => setIsMoreImg3Col(false)}
                  >
                    <i
                      style={{ maskImage: `url("${oneColSvg}")` }}
                      className="icon"
                    />
                  </button>
                  <button
                    className="more-pic-layout-btn"
                    type="button"
                    onClick={() => setIsMoreImg3Col(true)}
                  >
                    <i
                      style={{ maskImage: `url("${threeColSvg}")` }}
                      className="icon"
                    />
                  </button>
                </h6>
                <div className="d-flex flex-wrap">
                  {viewEditProduct.imagesUrl &&
                    viewEditProduct.imagesUrl.map((img, i) => (
                      <button
                        key={`more-image-container-${i}`}
                        className={`ratio ratio-4x3 mb-3 mx-auto ${
                          fullWho === `product-more-img-${i}`
                            ? "full-screen"
                            : ""
                        }`}
                        style={{ width: isMoreImg3Col ? "30%" : "90%" }}
                      >
                        {img && (
                          <>
                            <i
                              style={{
                                maskImage: `url("${
                                  fullWho === `product-more-img-${i}`
                                    ? minimizeSvg
                                    : maximizeSvg
                                }")`,
                              }}
                              className="full-screen-btn icon"
                              tabIndex={0}
                              onClick={(e) =>
                                handleFullscreen(e, `product-more-img-${i}`)
                              }
                            />
                            <img
                              src={img}
                              alt={`${"Deluxe Dog Bed"} - More Image ${i + 1}`}
                              className="rounded"
                            />
                          </>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
