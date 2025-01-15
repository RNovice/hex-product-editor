import React, { useState, useEffect } from "react";
import axios from "axios";
import CryptoJS from "crypto-js";
import Editor from "@monaco-editor/react";

import "./App.css";
import ExpireCountdown from "./components/ExpireCountdown";

const { VITE_API_BASE: API_BASE, VITE_SECRET_KEY: SECRET_KEY } = import.meta
  .env;
const saveLocalWarning = "如果你的帳號密碼與其他平台通用的話不建議使用";

/*
https://ec-course-api.hexschool.io/
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

  useEffect(() => {
    async function checkLogin() {
      setIsCheckingLogin(true);
      try {
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
        }
      } catch (err) {
        console.error(err);
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
    if (isLogin) getProducts();
  }, [isLogin]);

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
      // getProducts();
      setExpireTime(expired);
      setIsLogin(true);
    } catch (err) {
      console.error(err);
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
      }
    } catch (err) {
      console.error(err);
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

  return (
    <div className="container-fluid text-light" style={{ height: "100vh" }}>
      <div className="row h-100">
        <aside
          className="col-auto d-flex flex-column h-100 p-3 bg-dark"
          style={{ width: "calc(260px + (80px + .8rem) + .8rem * 6)" }}
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
          <div className="p-3 user-info">
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
        <main className="col d-flex flex-column">
          <div className="row flex-grow-1 ">
            <div className="col-md-7 p-3 bg-dark">
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
            <div className="col-md-5 p-3 bg-dark">
              <div className="card bg-dark text-light">
                <div className="ratio ratio-16x9">
                  <img
                    src={viewEditProduct.imageUrl}
                    className="card-img-top"
                    alt={viewEditProduct.title}
                    style={{ objectFit: "cover", objectPosition: "center" }}
                  />
                </div>
                <div className="card-body">
                  <h5 className="card-title">
                    <span className="text-secondary">標題：</span>
                    {viewEditProduct.title}
                  </h5>
                  <h6 className="card-subtitle mb-2">
                    <span className="text-secondary">分類：</span>
                    {viewEditProduct.category}
                  </h6>
                  <p className="card-text">
                    <span className="text-secondary">描述：</span>
                    <br />
                    {viewEditProduct.description}
                  </p>
                  <p className="card-text">
                    <span className="text-secondary">說明：</span>
                    <br />
                    {viewEditProduct.content}
                  </p>
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
                  <p className="card-text">
                    <span className="text-secondary">是否啟用：</span>
                    {viewEditProduct.is_enabled !== undefined
                      ? viewEditProduct.is_enabled
                        ? "已啟用"
                        : "未啟用"
                      : "找不到欄位"}
                  </p>
                </div>
                <div className="card-body">
                  <h6>更多圖片:</h6>
                  <div className="d-flex flex-wrap">
                    {viewEditProduct.imagesUrl &&
                      viewEditProduct.imagesUrl.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt={`${"Deluxe Dog Bed"} - More Image ${i + 1}`}
                          className="img-thumbnail me-2"
                          style={{
                            width: "75px",
                            height: "75px",
                            objectFit: "cover",
                          }}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row bg-dark" style={{ height: "150px" }}>
            <div className="col-md-7 p-3">
              <button className="btn btn-success me-2">Create</button>
              <button className="btn btn-warning me-2">Edit</button>
              <button className="btn btn-danger">Delete</button>
            </div>

            <div className="col-md-5 p-3 bg-dark overflow-auto h-100">
              <h6>Operation Log</h6>
              <ul className="list-group">
                {Array.from({ length: 10 }, (_, i) => (
                  <li
                    key={i}
                    className="list-group-item bg-dark text-light border-0"
                  >
                    Log entry {i + 1}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
