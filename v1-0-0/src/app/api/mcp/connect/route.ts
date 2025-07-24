import { NextRequest, NextResponse } from "next/server";
import { MCPClient } from "@mastra/mcp";

export async function POST(request: NextRequest) {
  try {
    const { serverConfig } = await request.json();

    if (!serverConfig) {
      return NextResponse.json(
        { success: false, error: "Server configuration is required" },
        { status: 400 },
      );
    }

    const client = new MCPClient({
      servers: { test: serverConfig },
    });

    await client.getTools();
    await client.disconnect();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 },
    );
  }
}
