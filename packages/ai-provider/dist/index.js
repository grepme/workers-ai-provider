var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/workersai-chat-language-model.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";
import { z as z2 } from "zod";

// src/convert-to-workersai-chat-messages.ts
import {
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
function convertToWorkersAIChatMessages(prompt) {
  const messages = [];
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        messages.push({ role: "system", content });
        break;
      }
      case "user": {
        messages.push({
          role: "user",
          content: content.map((part) => {
            switch (part.type) {
              case "text": {
                return part.text;
              }
              case "image": {
                throw new UnsupportedFunctionalityError({
                  functionality: "image-part"
                });
              }
            }
          }).join("")
        });
        break;
      }
      case "assistant": {
        let text = "";
        const toolCalls = [];
        for (const part of content) {
          switch (part.type) {
            case "text": {
              text += part.text;
              break;
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.args)
                }
              });
              break;
            }
            default: {
              const exhaustiveCheck = part;
              throw new Error(`Unsupported part: ${exhaustiveCheck}`);
            }
          }
        }
        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls.map(({ function: { name, arguments: args } }) => ({
            id: "null",
            type: "function",
            function: { name, arguments: args }
          })) : void 0
        });
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          messages.push({
            role: "tool",
            name: toolResponse.toolName,
            content: JSON.stringify(toolResponse.result)
          });
        }
        break;
      }
      default: {
        const exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${exhaustiveCheck}`);
      }
    }
  }
  return messages;
}

// src/workersai-error.ts
import {
  createJsonErrorResponseHandler
} from "@ai-sdk/provider-utils";
import { z } from "zod";
var workersAIErrorDataSchema = z.object({
  object: z.literal("error"),
  message: z.string(),
  type: z.string(),
  param: z.string().nullable(),
  code: z.string().nullable()
});
var workersAIFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: workersAIErrorDataSchema,
  errorToMessage: (data) => data.message
});

// src/workersai-chat-language-model.ts
import { events } from "fetch-event-stream";
var WorkersAIChatLanguageModel = class {
  constructor(modelId, settings, config) {
    __publicField(this, "specificationVersion", "v1");
    __publicField(this, "defaultObjectGenerationMode", "json");
    __publicField(this, "modelId");
    __publicField(this, "settings");
    __publicField(this, "config");
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed
  }) {
    const type = mode.type;
    const warnings = [];
    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty"
      });
    }
    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty"
      });
    }
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      safe_prompt: this.settings.safePrompt,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      random_seed: seed,
      // messages:
      messages: convertToWorkersAIChatMessages(prompt)
    };
    switch (type) {
      case "regular": {
        return {
          args: { ...baseArgs, ...prepareToolsAndToolChoice(mode) },
          warnings
        };
      }
      case "object-json": {
        return {
          args: {
            ...baseArgs,
            response_format: { type: "json_object" }
          },
          warnings
        };
      }
      case "object-tool": {
        return {
          args: {
            ...baseArgs,
            tool_choice: "any",
            tools: [{ type: "function", function: mode.tool }]
          },
          warnings
        };
      }
      // @ts-expect-error - this is unreachable code
      // TODO: fixme
      case "object-grammar": {
        throw new UnsupportedFunctionalityError2({
          functionality: "object-grammar mode"
        });
      }
      default: {
        const exhaustiveCheck = type;
        throw new Error(`Unsupported type: ${exhaustiveCheck}`);
      }
    }
  }
  async doGenerate(options) {
    const { args, warnings } = this.getArgs(options);
    const response = await this.config.binding.run(
      args.model,
      {
        messages: args.messages,
        max_tokens: args.max_tokens
      },
      {
        gateway: this.settings.gateway
      }
    );
    if (response instanceof ReadableStream) {
      throw new Error("This shouldn't happen");
    }
    return {
      text: response.response,
      // TODO: tool calls
      // toolCalls: response.tool_calls?.map((toolCall) => ({
      //   toolCallType: "function",
      //   toolCallId: toolCall.name, // TODO: what can the id be?
      //   toolName: toolCall.name,
      //   args: JSON.stringify(toolCall.arguments || {}),
      // })),
      finishReason: "stop",
      // TODO: mapWorkersAIFinishReason(response.finish_reason),
      rawCall: { rawPrompt: args.messages, rawSettings: args },
      usage: {
        // TODO: mapWorkersAIUsage(response.usage),
        promptTokens: 0,
        completionTokens: 0
      },
      warnings
    };
  }
  async doStream(options) {
    const { args, warnings } = this.getArgs(options);
    const decoder = new TextDecoder();
    const response = await this.config.binding.run(args.model, {
      messages: args.messages,
      stream: true,
      max_tokens: args.max_tokens
    });
    if (!(response instanceof ReadableStream)) {
      throw new Error("This shouldn't happen");
    }
    return {
      stream: response.pipeThrough(
        new TransformStream({
          async transform(chunk, controller) {
            const chunkToText = decoder.decode(chunk);
            const chunks = events(new Response(chunkToText));
            for await (const singleChunk of chunks) {
              if (!singleChunk.data) {
                continue;
              }
              if (singleChunk.data === "[DONE]") {
                controller.enqueue({
                  type: "finish",
                  finishReason: "stop",
                  usage: {
                    promptTokens: 0,
                    completionTokens: 0
                  }
                });
                return;
              }
              const data = JSON.parse(singleChunk.data);
              controller.enqueue({
                type: "text-delta",
                textDelta: data.response ?? "DATALOSS"
              });
            }
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: {
                promptTokens: 0,
                completionTokens: 0
              }
            });
          }
        })
      ),
      rawCall: { rawPrompt: args.messages, rawSettings: args },
      warnings
    };
  }
};
var workersAIChatResponseSchema = z2.object({
  response: z2.string()
});
var workersAIChatChunkSchema = z2.instanceof(Uint8Array);
function prepareToolsAndToolChoice(mode) {
  const tools = mode.tools?.length ? mode.tools : void 0;
  if (tools == null) {
    return { tools: void 0, tool_choice: void 0 };
  }
  const mappedTools = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      // @ts-expect-error - description is not a property of tool
      description: tool.description,
      // @ts-expect-error - parameters is not a property of tool
      parameters: tool.parameters
    }
  }));
  const toolChoice = mode.toolChoice;
  if (toolChoice == null) {
    return { tools: mappedTools, tool_choice: void 0 };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
      return { tools: mappedTools, tool_choice: type };
    case "none":
      return { tools: mappedTools, tool_choice: type };
    case "required":
      return { tools: mappedTools, tool_choice: "any" };
    // workersAI does not support tool mode directly,
    // so we filter the tools and force the tool choice through 'any'
    case "tool":
      return {
        tools: mappedTools.filter(
          (tool) => tool.function.name === toolChoice.toolName
        ),
        tool_choice: "any"
      };
    default: {
      const exhaustiveCheck = type;
      throw new Error(`Unsupported tool choice type: ${exhaustiveCheck}`);
    }
  }
}

// src/index.ts
function createWorkersAI(options) {
  const createChatModel = (modelId, settings = {}) => new WorkersAIChatLanguageModel(modelId, settings, {
    provider: "workersai.chat",
    binding: options.binding
  });
  const provider = function(modelId, settings) {
    if (new.target) {
      throw new Error(
        "The WorkersAI model function cannot be called with the new keyword."
      );
    }
    return createChatModel(modelId, settings);
  };
  provider.chat = createChatModel;
  return provider;
}
export {
  createWorkersAI
};
//# sourceMappingURL=index.js.map