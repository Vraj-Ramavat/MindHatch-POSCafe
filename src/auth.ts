import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

const demoAdminEmail = "admin@mindhatch.local";
const demoAdminPassword = "admin1234";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString() ?? "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user && email === demoAdminEmail && password === demoAdminPassword) {
          const passwordHash = await bcrypt.hash(demoAdminPassword, 12);

          const createdUser = await prisma.user.create({
            data: {
              name: "MindHatch Admin",
              email: demoAdminEmail,
              passwordHash,
              role: Role.ADMIN,
            },
          });

          return {
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
          };
        }

        if (!user) {
          return null;
        }

        const matches = await bcrypt.compare(password, user.passwordHash);

        if (!matches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.role = token.role ?? "CASHIER";
      }

      return session;
    },
  },
});

export async function safeAuth() {
  try {
    return await auth();
  } catch {
    return null;
  }
}