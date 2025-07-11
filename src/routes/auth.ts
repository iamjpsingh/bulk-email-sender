// src/routes/auth.ts
import { Hono } from "hono";
import { userDatabase } from "../services/userDatabase";
import { setCookie, deleteCookie } from "hono/cookie";

const app = new Hono();

// Register endpoint
app.post("/auth/register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, name, password } = body;

    // Validate input
    if (!email || !name || !password) {
      return c.json(
        {
          success: false,
          message: "Email, name, and password are required",
        },
        400
      );
    }

    if (password.length < 6) {
      return c.json(
        {
          success: false,
          message: "Password must be at least 6 characters",
        },
        400
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json(
        {
          success: false,
          message: "Invalid email format",
        },
        400
      );
    }

    try {
      const userId = await userDatabase.createUser(email, name, password);
      const token = await userDatabase.createSession(userId);

      // Set session cookie
      setCookie(c, "session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60, // 24 hours
      });

      return c.json({
        success: true,
        message: "Account created successfully",
        user: { id: userId, email, name },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Email already exists") {
        return c.json(
          {
            success: false,
            message: "An account with this email already exists",
          },
          409
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Registration error:", error);
    return c.json(
      {
        success: false,
        message: "Registration failed",
      },
      500
    );
  }
});

// Login endpoint
app.post("/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json(
        {
          success: false,
          message: "Email and password are required",
        },
        400
      );
    }

    const user = await userDatabase.authenticateUser(email, password);
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        401
      );
    }

    const token = await userDatabase.createSession(user.id);

    // Set session cookie
    setCookie(c, "session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return c.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json(
      {
        success: false,
        message: "Login failed",
      },
      500
    );
  }
});

// Logout endpoint
app.post("/auth/logout", async (c) => {
  try {
    const token = c.req.cookie("session_token");

    if (token) {
      userDatabase.deleteSession(token);
    }

    deleteCookie(c, "session_token");

    return c.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json(
      {
        success: false,
        message: "Logout failed",
      },
      500
    );
  }
});

// Check auth status
app.get("/auth/me", async (c) => {
  try {
    const token = c.req.cookie("session_token");

    if (!token) {
      return c.json(
        {
          success: false,
          message: "Not authenticated",
        },
        401
      );
    }

    const user = userDatabase.validateSession(token);
    if (!user) {
      deleteCookie(c, "session_token");
      return c.json(
        {
          success: false,
          message: "Session expired",
        },
        401
      );
    }

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return c.json(
      {
        success: false,
        message: "Auth check failed",
      },
      500
    );
  }
});

export default app;
