import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User } from "./models/user.schema";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { Auth } from "./models/auth.schema";

dotenv.config();

console.log(process.env.MONGO_URI);

mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("Mongodb connection success"))
  .catch((error) => {
    console.log("Mongodb connection failed");
    console.log(error);
  });

const app = express();
app.use(express.json());
app.use(cookieParser()); // express

// REGISTER USER
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  // input validation

  // hash password
  const hashedPassword = await bcrypt.hash(password, 13);

  // payload
  const newUser = {
    name,
    email,
    password: hashedPassword,
  };

  // insert to db
  const createUser = new User(newUser);
  const data = await createUser.save();

  return res.status(201).json({ message: "User register success", data });
});

// LOGIN USER
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // input validation
  if (!email || password.length < 8) {
    return res.json({ message: "email should be valid and password should have minimum 8 characters" });
  }

  // find user by email
  const user = await User.findOne({
    email,
  });

  // if user does not exist
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  // password validation
  const isPassMatch = await bcrypt.compare(password, user.password as string);

  if (!isPassMatch) {
    return res.status(400).json({ message: "invalid password" }); // client error
  }

  // authorization
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, {
    expiresIn: 300,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: "30d",
  });

  // TODO : Save Refresh Token to DB
  const newRefreshToken = new Auth({
    userId: user.id,
    refreshToken,
  });
  await newRefreshToken.save();

  return res
    .cookie("accessToken", accessToken, { httpOnly: true })
    .cookie("refreshToken", refreshToken, { httpOnly: true })
    .status(200)
    .json({ message: "Login success!" });
});

app.post("/logout", async (req, res) => {
  const { refreshToken } = req.cookies;
  // delete token di DB
  await Auth.findOneAndDelete({
    refreshToken,
  });

  return res.clearCookie("accessToken").clearCookie("refreshToken").json({ message: "Logout berhasil" });
});

// RESOURCES ENDPOINT
app.get("/resources", async (req, res) => {
  const { accessToken, refreshToken } = req.cookies;

  // Check if Access Token Exist
  if (accessToken) {
    try {
      jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET as string);
      console.log("Access token masih valid");
      return res.json({ data: "Ini datanya..." });
    } catch (error) {
      // If false, regenerate new access token from refreshToken
      if (!refreshToken) {
        console.log("Refresh Token tidak ada");
        return res.status(401).json({ message: "Please re-login..." });
      }

      try {
        // Check if Refresh Token Valid
        console.log("Verifikasi Refresh Token");
        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string);
        // If valid, verify if it's exist in database
        console.log("Cek refresh token ke database");
        const activeRefreshToken = await Auth.findOne({
          refreshToken,
        });

        if (!activeRefreshToken) {
          console.log("Refresh token tidak ada di database");
          return res.status(401).json({ message: "Please re-login..." });
        }

        const payload = jwt.decode(refreshToken) as { id: string; name: string; email: string };

        console.log("Bikin accessToken baru");
        const newAccessToken = jwt.sign(
          {
            id: payload?.id,
            name: payload.name,
            email: payload.email,
          },
          process.env.JWT_ACCESS_SECRET as string,
          { expiresIn: 300 }
        );

        return res.cookie("accessToken", newAccessToken, { httpOnly: true }).json({ data: "Ini datanya..." });
        // regenerate new access token
      } catch (error) {
        // If invalid, user need to re-login
        return res.status(401).json({ message: "Please re-login..." });
      }
    }
  }

  return res.send("Make sure you logged in");

  // If Exist, verify Access Token
  // console.log({ accessToken, refreshToken });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running at port : ${process.env.PORT}`);
});
