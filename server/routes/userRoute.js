import express from 'express';
import { isAuth, login, logout, register, clerkGoogleAuth } from '../controllers/userController.js';
import authUser, { optionalAuthUser } from '../middlewares/authUser.js';
import { userLoginLimiter, userRegisterLimiter, clerkAuthLimiter } from '../middlewares/rateLimiter.js';


const userRouter = express.Router();

userRouter.post('/register', userRegisterLimiter, register)
userRouter.post('/login', userLoginLimiter, login)
userRouter.post('/clerk/google', clerkAuthLimiter, clerkGoogleAuth)
userRouter.get('/is-auth', optionalAuthUser, isAuth)
userRouter.post('/logout', logout)
userRouter.get('/logout', logout)

export default userRouter;
