import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bloodBankRouter from "./blood-bank";
import demoRouter from "./demo-mock";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bloodBankRouter);
router.use(demoRouter);

export default router;
