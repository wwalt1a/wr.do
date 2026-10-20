import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { getMultipleConfigs } from "@/lib/dto/system-config";
import { hashPassword, verifyPassword } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, turnstileToken } = await req.json();
    if (!email || !password) {
      return Response.json("email and password is required", { status: 400 });
    }

    // Cloudflare Turnstile 防爆破人机验证
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        return Response.json("Turnstile verification token is required", {
          status: 403,
        });
      }

      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "";

      const formData = new URLSearchParams();
      formData.append("secret", turnstileSecret);
      formData.append("response", turnstileToken);
      if (clientIp) {
        formData.append("remoteip", clientIp);
      }

      const cfRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: formData,
        },
      );

      const cfData = await cfRes.json();
      if (!cfData.success) {
        console.error("[Turnstile verification failed]", cfData["error-codes"]);
        return Response.json("Turnstile verification failed", { status: 403 });
      }
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      const configs = await getMultipleConfigs(["enable_user_registration"]);
      if (!configs.enable_user_registration) {
        return Response.json("User registration is disabled", { status: 403 });
      }
      const newUser = await prisma.user.create({
        data: {
          name: "",
          email,
          password: hashPassword(password),
          active: 1,
          role: "USER",
          team: "free",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      return Response.json(newUser, { status: 200 });
    } else {
      if (user.active === 0) {
        return Response.json(null, { status: 403 });
      }
      const passwordCorrect = verifyPassword(password, user.password || "");
      if (passwordCorrect) {
        return Response.json(user, { status: 200 });
      }
    }

    return Response.json(null, { status: 400 });
  } catch (error) {
    console.error("[Auth Error]", error);
    return Response.json(error.message || "Server error", { status: 500 });
  }
}
