import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { Router, type Response, type Request, type NextFunction } from 'express';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import {
  signInService,
  signOutService,
  signUpService,
  verifyToken,
  createAccessTokenService,
} from './auth.services.ts';
import { validateData } from '../middlewares/validateRoute.ts';
import { signInLocalSchema, signUpLocalSchema } from './auth.route.validations.ts';

const validateRequest = async (req: Request, res: Response, next: NextFunction) => {
  let accessToken = req.headers['authorization']
    ? String(req.headers['authorization']).split(' ')[1]
    : null;
  const refreshToken = req.headers['x-refresh-token']
    ? String(req.headers['x-refresh-token']).split(' ')[1]
    : null;

  if (!accessToken || !refreshToken)
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: ReasonPhrases.UNAUTHORIZED });

  try {
    const { userId } = await verifyToken(accessToken).catch(() => {
      return { userId: null };
    });

    if (!userId) {
      accessToken = await createAccessTokenService(refreshToken);
    }

    if (!userId || !accessToken) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: ReasonPhrases.UNAUTHORIZED });
    }

    res.locals.accessToken = accessToken;
    res.locals.userId = userId;

    return next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: ReasonPhrases.UNAUTHORIZED });
  }
};

const authRouter = Router();

authRouter.post('/auth/local/sign-in', validateData(signInLocalSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await signInService(email, password);
    res.status(StatusCodes.OK).json(result);
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.UNAUTHORIZED).json({ error: ReasonPhrases.UNAUTHORIZED });
  }
});

authRouter.post('/auth/local/sign-up', validateData(signUpLocalSchema), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const result = await signUpService(username, email, password);
    res.status(StatusCodes.OK).json(result);
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.BAD_REQUEST).json({ error: ReasonPhrases.BAD_REQUEST });
  }
});

authRouter.patch('/auth/sign-in', async (req, res) => {});

authRouter.post('/auth/sign-out', async (_req, res) => {
  try {
    const refreshToken = res.locals.refreshToken;
    await signOutService(refreshToken);
    res.status(StatusCodes.OK).json({ message: 'Successfully signed out' });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: ReasonPhrases.BAD_REQUEST });
  }
});

authRouter.get('/auth/me', validateRequest, async (_req, res) => {
  try {
    const userId = res.locals.userId;
    const user = await UsuarioModel.findById(userId);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: ReasonPhrases.NOT_FOUND });
    }
    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: ReasonPhrases.BAD_REQUEST });
  }
});

export { authRouter, validateRequest };

