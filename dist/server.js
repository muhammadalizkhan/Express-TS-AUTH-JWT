"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = __importDefault(require("mongoose"));
const user_schema_1 = require("./models/user.schema");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_schema_1 = require("./models/auth.schema");
dotenv_1.default.config();
mongoose_1.default
    .connect(process.env.MONGO_URI)
    .then(() => console.log("Mongodb connection success"))
    .catch((error) => {
    console.log("Mongodb connection failed");
    console.log(error);
});
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)()); // express
// REGISTER USER
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, email, password } = req.body;
    // input validation
    // hash password
    const hashedPassword = yield bcrypt_1.default.hash(password, 13);
    // payload
    const newUser = {
        name,
        email,
        password: hashedPassword,
    };
    // insert to db
    const createUser = new user_schema_1.User(newUser);
    const data = yield createUser.save();
    return res.status(201).json({ message: "User register success", data });
}));
// LOGIN USER
app.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    // input validation
    if (!email || password.length < 8) {
        return res.json({ message: "email should be valid and password should have minimum 8 characters" });
    }
    // find user by email
    const user = yield user_schema_1.User.findOne({
        email,
    });
    // if user does not exist
    if (!user) {
        return res.status(404).json({ message: "user not found" });
    }
    // password validation
    const isPassMatch = yield bcrypt_1.default.compare(password, user.password);
    if (!isPassMatch) {
        return res.status(400).json({ message: "invalid password" }); // client error
    }
    // authorization
    const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
    };
    const accessToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_ACCESS_SECRET, {
        expiresIn: 300,
    });
    const refreshToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "30d",
    });
    // TODO : Save Refresh Token to DB
    const newRefreshToken = new auth_schema_1.Auth({
        userId: user.id,
        refreshToken,
    });
    yield newRefreshToken.save();
    return res
        .cookie("accessToken", accessToken, { httpOnly: true })
        .cookie("refreshToken", refreshToken, { httpOnly: true })
        .status(200)
        .json({ message: "Login success!" });
}));
app.post("/logout", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.cookies;
    // delete token di DB
    yield auth_schema_1.Auth.findOneAndDelete({
        refreshToken,
    });
    return res.clearCookie("accessToken").clearCookie("refreshToken").json({ message: "Logout berhasil" });
}));
// RESOURCES ENDPOINT
app.get("/resources", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { accessToken, refreshToken } = req.cookies;
    // Check if Access Token Exist
    if (accessToken) {
        try {
            jsonwebtoken_1.default.verify(accessToken, process.env.JWT_ACCESS_SECRET);
            console.log("Access token masih valid");
            return res.json({ data: "Ini datanya..." });
        }
        catch (error) {
            // If false, regenerate new access token from refreshToken
            if (!refreshToken) {
                console.log("Refresh Token tidak ada");
                return res.status(401).json({ message: "Please re-login..." });
            }
            try {
                // Check if Refresh Token Valid
                console.log("Verifikasi Refresh Token");
                jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
                // If valid, verify if it's exist in database
                console.log("Cek refresh token ke database");
                const activeRefreshToken = yield auth_schema_1.Auth.findOne({
                    refreshToken,
                });
                if (!activeRefreshToken) {
                    console.log("Refresh token tidak ada di database");
                    return res.status(401).json({ message: "Please re-login..." });
                }
                const payload = jsonwebtoken_1.default.decode(refreshToken);
                console.log("Bikin accessToken baru");
                const newAccessToken = jsonwebtoken_1.default.sign({
                    id: payload === null || payload === void 0 ? void 0 : payload.id,
                    name: payload.name,
                    email: payload.email,
                }, process.env.JWT_ACCESS_SECRET, { expiresIn: 300 });
                return res.cookie("accessToken", newAccessToken, { httpOnly: true }).json({ data: "Ini datanya..." });
                // regenerate new access token
            }
            catch (error) {
                // If invalid, user need to re-login
                return res.status(401).json({ message: "Please re-login..." });
            }
        }
    }
    // If Exist, verify Access Token
    // console.log({ accessToken, refreshToken });
}));
app.listen(process.env.PORT, () => {
    console.log(`Server running at port : ${process.env.PORT}`);
});
