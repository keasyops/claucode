#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Tool definitions
const listChannelsTool = {
    name: "slack_list_channels",
    description: "List public channels in the workspace with pagination",
    inputSchema: {
        type: "object",
        properties: {
            limit: {
                type: "number",
                description: "Maximum number of channels to return (default 100, max 200)",
                default: 100,
            },
            cursor: {
                type: "string",
                description: "Pagination cursor for next page of results",
            },
        },
    },
};
const postMessageTool = {
    name: "slack_post_message",
    description: "Post a new message to a Slack channel",
    inputSchema: {
        type: "object",
        properties: {
            channel_id: {
                type: "string",
                description: "The ID of the channel to post to",
            },
            text: {
                type: "string",
                description: "The message text to post",
            },
        },
        required: ["channel_id", "text"],
    },
};
const replyToThreadTool = {
    name: "slack_reply_to_thread",
    description: "Reply to a specific message thread in Slack",
    inputSchema: {
        type: "object",
        properties: {
            channel_id: {
                type: "string",
                description: "The ID of the channel containing the thread",
            },
            thread_ts: {
                type: "string",
                description: "The timestamp of the parent message",
            },
            text: {
                type: "string",
                description: "The reply text",
            },
        },
        required: ["channel_id", "thread_ts", "text"],
    },
};
const addReactionTool = {
    name: "slack_add_reaction",
    description: "Add a reaction emoji to a message",
    inputSchema: {
        type: "object",
        properties: {
            channel_id: {
                type: "string",
                description: "The ID of the channel containing the message",
            },
            timestamp: {
                type: "string",
                description: "The timestamp of the message to react to",
            },
            reaction: {
                type: "string",
                description: "The name of the emoji reaction (without ::)",
            },
        },
        required: ["channel_id", "timestamp", "reaction"],
    },
};
const getChannelHistoryTool = {
    name: "slack_get_channel_history",
    description: "Get recent messages from a channel",
    inputSchema: {
        type: "object",
        properties: {
            channel_id: {
                type: "string",
                description: "The ID of the channel",
            },
            limit: {
                type: "number",
                description: "Number of messages to retrieve (default 10)",
                default: 10,
            },
        },
        required: ["channel_id"],
    },
};
const getThreadRepliesTool = {
    name: "slack_get_thread_replies",
    description: "Get all replies in a message thread",
    inputSchema: {
        type: "object",
        properties: {
            channel_id: {
                type: "string",
                description: "The ID of the channel containing the thread",
            },
            thread_ts: {
                type: "string",
                description: "The timestamp of the parent message",
            },
        },
        required: ["channel_id", "thread_ts"],
    },
};
const getUsersTool = {
    name: "slack_get_users",
    description: "Get a list of all users in the workspace with their basic profile information",
    inputSchema: {
        type: "object",
        properties: {
            cursor: {
                type: "string",
                description: "Pagination cursor for next page of results",
            },
            limit: {
                type: "number",
                description: "Maximum number of users to return (default 100, max 200)",
                default: 100,
            },
        },
    },
};
const getUserProfileTool = {
    name: "slack_get_user_profile",
    description: "Get detailed profile information for a specific user",
    inputSchema: {
        type: "object",
        properties: {
            user_id: {
                type: "string",
                description: "The ID of the user",
            },
        },
        required: ["user_id"],
    },
};
class SlackClient {
    botHeaders;
    constructor(botToken) {
        this.botHeaders = {
            Authorization: `Bearer ${botToken}`,
            "Content-Type": "application/json",
        };
    }
    async getChannels(limit = 100, cursor) {
        const params = new URLSearchParams({
            types: "public_channel",
            exclude_archived: "true",
            limit: Math.min(limit, 200).toString(),
            team_id: process.env.SLACK_TEAM_ID,
        });
        if (cursor) {
            params.append("cursor", cursor);
        }
        const response = await fetch(`https://slack.com/api/conversations.list?${params}`, { headers: this.botHeaders });
        return response.json();
    }
    async postMessage(channel_id, text) {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: this.botHeaders,
            body: JSON.stringify({
                channel: channel_id,
                text: text,
            }),
        });
        return response.json();
    }
    async postReply(channel_id, thread_ts, text) {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: this.botHeaders,
            body: JSON.stringify({
                channel: channel_id,
                thread_ts: thread_ts,
                text: text,
            }),
        });
        return response.json();
    }
    async addReaction(channel_id, timestamp, reaction) {
        const response = await fetch("https://slack.com/api/reactions.add", {
            method: "POST",
            headers: this.botHeaders,
            body: JSON.stringify({
                channel: channel_id,
                timestamp: timestamp,
                name: reaction,
            }),
        });
        return response.json();
    }
    async getChannelHistory(channel_id, limit = 10) {
        const params = new URLSearchParams({
            channel: channel_id,
            limit: limit.toString(),
        });
        const response = await fetch(`https://slack.com/api/conversations.history?${params}`, { headers: this.botHeaders });
        return response.json();
    }
    async getThreadReplies(channel_id, thread_ts) {
        const params = new URLSearchParams({
            channel: channel_id,
            ts: thread_ts,
        });
        const response = await fetch(`https://slack.com/api/conversations.replies?${params}`, { headers: this.botHeaders });
        return response.json();
    }
    async getUsers(limit = 100, cursor) {
        const params = new URLSearchParams({
            limit: Math.min(limit, 200).toString(),
            team_id: process.env.SLACK_TEAM_ID,
        });
        if (cursor) {
            params.append("cursor", cursor);
        }
        const response = await fetch(`https://slack.com/api/users.list?${params}`, {
            headers: this.botHeaders,
        });
        return response.json();
    }
    async getUserProfile(user_id) {
        const params = new URLSearchParams({
            user: user_id,
            include_labels: "true",
        });
        const response = await fetch(`https://slack.com/api/users.profile.get?${params}`, { headers: this.botHeaders });
        return response.json();
    }
}
async function main() {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const teamId = process.env.SLACK_TEAM_ID;
    if (!botToken || !teamId) {
        console.error("Please set SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables");
        process.exit(1);
    }
    console.error("Starting Slack MCP Server...");
    const server = new Server({
        name: "Slack MCP Server",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    const slackClient = new SlackClient(botToken);
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        console.error("Received CallToolRequest:", request);
        try {
            if (!request.params.arguments) {
                throw new Error("No arguments provided");
            }
            switch (request.params.name) {
                case "slack_list_channels": {
                    const args = request.params
                        .arguments;
                    const response = await slackClient.getChannels(args.limit, args.cursor);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                case "slack_post_message": {
                    const args = request.params.arguments;
                    if (!args.channel_id || !args.text) {
                        throw new Error("Missing required arguments: channel_id and text");
                    }
                    const response = await slackClient.postMessage(args.channel_id, args.text);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                case "slack_reply_to_thread": {
                    const args = request.params
                        .arguments;
                    if (!args.channel_id || !args.thread_ts || !args.text) {
                        throw new Error("Missing required arguments: channel_id, thread_ts, and text");
                    }
                    const response = await slackClient.postReply(args.channel_id, args.thread_ts, args.text);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                case "slack_add_reaction": {
                    const args = request.params.arguments;
                    if (!args.channel_id || !args.timestamp || !args.reaction) {
                        throw new Error("Missing required arguments: channel_id, timestamp, and reaction");
                    }
                    const response = await slackClient.addReaction(args.channel_id, args.timestamp, args.reaction);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                case "slack_get_channel_history": {
                    const args = request.params
                        .arguments;
                    if (!args.channel_id) {
                        throw new Error("Missing required argument: channel_id");
                    }
                    const response = await slackClient.getChannelHistory(args.channel_id, args.limit);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                case "slack_get_thread_replies": {
                    const args = request.params
                        .arguments;
                    if (!args.channel_id || !args.thread_ts) {
                        throw new Error("Missing required arguments: channel_id and thread_ts");
                    }
                    const response = await slackClient.getThreadReplies(args.channel_id, args.thread_ts);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                case "slack_get_users": {
                    const args = request.params.arguments;
                    const response = await slackClient.getUsers(args.limit, args.cursor);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                case "slack_get_user_profile": {
                    const args = request.params
                        .arguments;
                    if (!args.user_id) {
                        throw new Error("Missing required argument: user_id");
                    }
                    const response = await slackClient.getUserProfile(args.user_id);
                    return {
                        content: [{ type: "text", text: JSON.stringify(response) }],
                    };
                }
                default:
                    throw new Error(`Unknown tool: ${request.params.name}`);
            }
        }
        catch (error) {
            console.error("Error executing tool:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error),
                        }),
                    },
                ],
            };
        }
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.error("Received ListToolsRequest");
        return {
            tools: [
                listChannelsTool,
                postMessageTool,
                replyToThreadTool,
                addReactionTool,
                getChannelHistoryTool,
                getThreadRepliesTool,
                getUsersTool,
                getUserProfileTool,
            ],
        };
    });
    const transport = new StdioServerTransport();
    console.error("Connecting server to transport...");
    await server.connect(transport);
    console.error("Slack MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});