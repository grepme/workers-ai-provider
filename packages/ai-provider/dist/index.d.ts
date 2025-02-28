import { LanguageModelV1 } from '@ai-sdk/provider';

interface WorkersAIChatSettings {
    /**
    Whether to inject a safety prompt before all conversations.
    
    Defaults to `false`.
       */
    safePrompt?: boolean;
    /**
     * Optionally set Cloudflare AI Gateway options.
     */
    gateway?: GatewayOptions;
}

type WorkersAIChatConfig = {
    provider: string;
    binding: Ai;
};
declare class WorkersAIChatLanguageModel implements LanguageModelV1 {
    readonly specificationVersion = "v1";
    readonly defaultObjectGenerationMode = "json";
    readonly modelId: BaseAiTextGenerationModels;
    readonly settings: WorkersAIChatSettings;
    private readonly config;
    constructor(modelId: BaseAiTextGenerationModels, settings: WorkersAIChatSettings, config: WorkersAIChatConfig);
    get provider(): string;
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV1["doGenerate"]>[0]): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>>;
    doStream(options: Parameters<LanguageModelV1["doStream"]>[0]): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>>;
}

interface WorkersAI {
    (modelId: BaseAiTextGenerationModels, settings?: WorkersAIChatSettings): WorkersAIChatLanguageModel;
    /**
     * Creates a model for text generation.
     **/
    chat(modelId: BaseAiTextGenerationModels, settings?: WorkersAIChatSettings): WorkersAIChatLanguageModel;
}
interface WorkersAISettings {
    /**
     * Provide an `env.AI` binding to use for the AI inference.
     * You can set up an AI bindings in your Workers project
     * by adding the following this to `wrangler.toml`:
    
    ```toml
  [ai]
  binding = "AI"
    ```
     **/
    binding: Ai;
}
/**
 * Create a Workers AI provider instance.
 **/
declare function createWorkersAI(options: WorkersAISettings): WorkersAI;

export { type WorkersAI, type WorkersAISettings, createWorkersAI };
