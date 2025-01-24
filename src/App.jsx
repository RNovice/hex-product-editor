import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import CryptoJS from "crypto-js";
import Editor from "@monaco-editor/react";

import "./App.css";
import ExpireCountdown from "./components/ExpireCountdown";
import {
  maximizeSvg,
  minimizeSvg,
  oneColSvg,
  threeColSvg,
  saveSvg,
  trashCanSvg,
  pasteSvg,
  plusSvg,
  reloadSvg,
} from "./assets/svg";

const { VITE_API_BASE: API_BASE, VITE_SECRET_KEY: SECRET_KEY } = import.meta
  .env;
const saveLocalWarning = "如果你的帳號密碼與其他平台通用的話不建議使用";
const filedNotFound = <span className="text-danger">找不到資料</span>;

/*
https://hexschool.github.io/ec-courses-api-swaggerDoc/
*/

const emptyProductData = () => ({
  category: "",
  content: "",
  description: "",
  imageUrl: "",
  imagesUrl: [],
  is_enabled: 1,
  origin_price: 0,
  price: 0,
  title: "",
  unit: "",
});

const newProductsJson = JSON.stringify([emptyProductData()], null, "\t");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isObject = (variable) =>
  typeof variable === "object" && variable !== null && !Array.isArray(variable);
const isObjectArray = (variable) =>
  Array.isArray(variable) && variable.every((item) => isObject(item));

const App = () => {
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [expireTime, setExpireTime] = useState(null);
  const [userAcct, setUserAcct] = useState({
    username: "",
    password: "",
  });
  const [API_Path, setAPI_Path] = useState("");
  const [existProducts, setExistProducts] = useState([]);
  const [newProducts, setNewProducts] = useState([emptyProductData()]);
  const [selected, setSelected] = useState(null);
  const [viewEditProduct, setViewEditProduct] = useState({});
  const [json, setJson] = useState(null);
  const [editMode, setEditMode] = useState(true);
  const [fullWho, setFullWho] = useState(null);
  const [isMoreImg3Col, setIsMoreImg3Col] = useState(false);
  const [operationLog, setOperationLog] = useState([]);
  const [logKey, setLogKey] = useState(0);
  const logRef = useRef();
  const editorRef = useRef(null);

  useEffect(() => {
    async function checkLogin() {
      setIsCheckingLogin(true);
      try {
        logOperation({ msg: "檢查登入狀態" });
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
          logOperation({ msg: "登入狀態：已登入" });
        }
      } catch (err) {
        console.error(err);
        logOperation({ msg: "請重新登入", type: "log-warning" });
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

  useEffect(() => {
    setFormattedJson(editMode ? existProducts : newProducts);
    setViewEditProduct({});
    setSelected(null);
  }, [editMode]);

  useEffect(() => {
    if (editMode) {
    } else {
      setNewProducts(JSON.parse(json));
    }
  }, [json]);

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
    const userInfoObj = {
      pa: API_Path || undefined,
      nu: username ? encrypt(username) : undefined,
      wp: password ? encrypt(password) : undefined,
    };
    logOperation({
      msg:
        Object.keys(userInfoObj).length === 0
          ? "已刪除儲存資料"
          : "已儲存資料在本地",
      type: "log-success",
    });
    Object.keys(userInfoObj).length === 0;
    localStorage.setItem("ui", JSON.stringify(userInfoObj));
  }

  function handleEditorChange(newValue) {
    if (editMode) {
    } else {
      setNewProducts(JSON.parse(newValue));
    }
    setJson(newValue);
  }

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  function handleFullscreen(e, target) {
    e.target.focus();
    setFullWho(target === fullWho ? null : target);
  }

  async function handleAddNewProduct() {
    let refresh = false;
    const failArr = [];
    if (!checkSyntaxRight()) return;
    const productList = JSON.parse(json);
    if (!isObjectArray(productList))
      return logOperation({
        msg: "新增模式中 json 必須是物件陣列 | 請檢查",
        type: "log-warning",
      });
    for (const product of productList) {
      try {
        await axios.post(`${API_BASE}/api/${API_Path}/admin/product/`, {
          data: product,
        });
        await sleep(250);
        logOperation({ msg: `${product.title} 新增成功`, type: "log-success" });
        refresh = true;
      } catch (err) {
        const axiosError = err.response?.data.message;
        const msg = `${product.title || "未命名產品"} 新增失敗 | ${
          axiosError?.join(", ") || err
        }`;
        logOperation({ msg, type: "log-err" });
        failArr.push(product);
      }
    }
    setViewEditProduct({});
    if (refresh) getProducts();
    if (failArr.length) {
      setFormattedJson(failArr);
    } else {
      logOperation({ msg: "切換為編輯模式" });
      setEditMode(true);
    }
  }

  async function handlePasteProduct() {
    const source = await navigator.clipboard.readText();
    try {
      const data = JSON.parse(source);
      if (isObject(data)) {
        setFormattedJson([...newProducts, data]);
        logOperation({ msg: `已貼上 1筆資料` });
        moveToLineOrBottom();
      } else if (isObjectArray(data)) {
        setFormattedJson([...newProducts, ...data]);
        logOperation({ msg: `已貼上 ${data.length}筆資料` });
        moveToLineOrBottom();
      } else {
        logOperation({
          msg: "貼上格式不正確 | 僅接受單筆物件或物件陣列",
          type: "log-warning",
        });
      }
    } catch {
      logOperation({
        msg: "貼上格式不正確 | 僅接受單筆物件或物件陣列",
        type: "log-warning",
      });
    }
  }

  async function getProducts() {
    try {
      const res = await axios.get(
        `${API_BASE}/api/${API_Path}/admin/products/all`
      );
      const allProducts = Object.values(res.data.products);
      setExistProducts(allProducts);
      if (editMode) setFormattedJson(allProducts);
      logOperation({ msg: `成功撈取資料: ${allProducts.length}筆產品` });
    } catch (err) {
      console.error(err);
      logOperation({ msg: `撈取資料失敗`, type: "log-err" });
    }
  }

  function logOperation({ msg, type = "" }) {
    const now = new Date();
    const HH = now.getHours().toString().padStart(2, "0");
    const MM = now.getMinutes().toString().padStart(2, "0");
    const SS = now.getSeconds().toString().padStart(2, "0");
    logRef.current?.scrollTo(0, 0);
    setOperationLog((pre) => [
      { msg: `${HH}:${MM}:${SS} | ${msg}`, type },
      ...pre,
    ]);
  }

  function setFormattedJson(value) {
    setJson(JSON.stringify(value, null, "\t"));
  }

  function moveToLineOrBottom(num = null) {
    if (editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();

      editor.revealLineInCenter(num === null ? model.getLineCount() : num);
    }
  }

  function checkSyntaxRight() {
    const model = editorRef.current.getModel();
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    if (markers.length) {
      logOperation({ msg: "編輯器中 json 語法錯誤", type: "log-warning" });
      return false;
    }
    return true;
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
              {(editMode ? existProducts : newProducts).map((product, i) => (
                <li
                  key={`aside-product-li-${i}`}
                  className={`list-group-item bg-dark text-light aside-product-li d-flex ${
                    selected === `aside-product-li-${i}` ? " selected" : ""
                  }`}
                  onClick={() => {
                    setViewEditProduct(product);
                    setSelected(`aside-product-li-${i}`);
                  }}
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
                onMount={handleEditorDidMount}
                options={{
                  folding: true,
                  foldingHighlight: true,
                  wordWrap: "on",
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            </div>
            <div
              className="row bg-dark mx-0 gap-3 overflow-hidden"
              style={{ height: "150px" }}
            >
              <div className="col-md-5 p-3 d-flex control-penal gap-3">
                <div className="d-flex flex-column align-items-center">
                  <div className="d-flex justify-content-center align-items-center control-mode user-select-none">
                    {editMode ? "編 輯" : " 新 增"}
                    <br />模 式
                  </div>
                  <button
                    className="control-mode-switch btn btn-success"
                    onClick={() =>
                      setEditMode((pre) => {
                        logOperation({ msg: !pre ? "編輯模式" : "新增模式" });
                        return !pre;
                      })
                    }
                  >
                    切換
                    <span className="control-mode-switch-quote">
                      {editMode ? "新增" : "編輯"}
                    </span>
                    模式
                  </button>
                </div>
                {editMode ? (
                  <div className="mx-auto d-flex flex-column justify-content-around edit-tools control-tools">
                    <div className="text-center">
                      {viewEditProduct.title === undefined ? (
                        "請選擇要編輯的產品"
                      ) : (
                        <ruby>
                          {viewEditProduct.title}
                          <rt className="text-secondary">
                            {viewEditProduct.id}
                          </rt>
                        </ruby>
                      )}
                    </div>
                    <div className="text-center">
                      <button title="保存變更此產品">
                        <i
                          style={{ maskImage: `url("${saveSvg}")` }}
                          className="icon bg-success"
                        />
                      </button>
                      <button title="重製回原本資料">
                        <i
                          style={{ maskImage: `url("${reloadSvg}")` }}
                          className="icon bg-warning"
                        />
                      </button>
                      <button title="刪除此產品">
                        <i
                          style={{ maskImage: `url("${trashCanSvg}")` }}
                          className="icon bg-danger"
                          onClick={() => {}}
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto d-flex flex-wrap justify-content-center align-items-center add-new-tools control-tools">
                    <button
                      title="加新產品"
                      onClick={() => {
                        setJson((pre) =>
                          JSON.stringify(
                            [...JSON.parse(pre), emptyProductData()],
                            null,
                            "\t"
                          )
                        );
                        moveToLineOrBottom();
                      }}
                    >
                      <i
                        style={{ maskImage: `url("${plusSvg}")` }}
                        className="icon bg-warning"
                        onClick={() => {}}
                      />
                    </button>
                    <button title="貼上產品" onClick={handlePasteProduct}>
                      <i
                        style={{ maskImage: `url("${pasteSvg}")` }}
                        className="icon bg-warning"
                      />
                    </button>
                    <button
                      title="重新開始"
                      onClick={() => {
                        setJson(newProductsJson);
                        moveToLineOrBottom(1);
                      }}
                    >
                      <i
                        style={{ maskImage: `url("${reloadSvg}")` }}
                        className="icon bg-danger"
                      />
                    </button>
                    <button title="上傳保存" onClick={handleAddNewProduct}>
                      <i
                        style={{ maskImage: `url("${saveSvg}")` }}
                        className="icon bg-success"
                      />
                    </button>
                  </div>
                )}
              </div>
              <div
                className="col bg-log overflow-auto h-100 rounded p-0 position-relative"
                ref={logRef}
              >
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
              {Object.keys(viewEditProduct).length !== 0 && (
                <>
                  <div className="card-body px-0 d-flex flex-column gap-2">
                    <h5 className="card-title">
                      <span className="text-secondary">標題：</span>
                      {viewEditProduct.title ?? filedNotFound}
                    </h5>
                    <div className="d-flex gap-3">
                      <p className="card-subtitle mb-2">
                        <span className="text-secondary">分類：</span>
                        {viewEditProduct.category ?? filedNotFound}
                      </p>
                      <p className="card-text">
                        <span className="text-secondary">是否啟用：</span>
                        {viewEditProduct.is_enabled !== undefined
                          ? viewEditProduct.is_enabled
                            ? "已啟用"
                            : "未啟用"
                          : filedNotFound}
                      </p>
                    </div>
                    <div className="d-flex gap-3">
                      <p className="card-text">
                        <span className="text-secondary">原價：</span>
                        {viewEditProduct.origin_price ?? filedNotFound}
                      </p>
                      <p className="card-text">
                        <span className="text-secondary">售價：</span>
                        {viewEditProduct.price ?? filedNotFound}
                      </p>
                      <p className="card-text">
                        <span className="text-secondary">單位：</span>
                        {viewEditProduct.unit ?? filedNotFound}
                      </p>
                    </div>
                    <p className="card-text">
                      <span className="text-secondary">描述：</span>
                      <br />
                      <br />
                      {viewEditProduct.description ?? filedNotFound}
                    </p>
                    <p className="card-text">
                      <span className="text-secondary">說明：</span>
                      <br />
                      <br />
                      {viewEditProduct.content ?? filedNotFound}
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
                    {viewEditProduct.imagesUrl !== undefined ? (
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
                                      handleFullscreen(
                                        e,
                                        `product-more-img-${i}`
                                      )
                                    }
                                  />
                                  <img
                                    src={img}
                                    alt={`${"Deluxe Dog Bed"} - More Image ${
                                      i + 1
                                    }`}
                                    className="rounded"
                                  />
                                </>
                              )}
                            </button>
                          ))}
                      </div>
                    ) : (
                      filedNotFound
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
