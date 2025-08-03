import { Router } from "express";
import fetch, { Headers } from "node-fetch";
const authRouter = Router();
authRouter.options("/proxy", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.sendStatus(200);
});
authRouter.get("/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
        return res.status(400).send("URL is required");
    }
    try {
        const headers = new Headers();
        if (req.headers.accept) {
            headers.set("Accept", req.headers.accept);
        }
        if (req.headers.authorization) {
            headers.set("Authorization", req.headers.authorization);
        }
        const response = await fetch(url, { headers });
        const data = await response.json();
        res.json(data);
    }
    catch (error) {
        console.error("Error proxying request:", error);
        res.status(500).send("Error proxying request");
    }
});
export default authRouter;
