import { GoogleGenAI } from "@google/genai";

// Initialize the client strictly with the environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a creative product description based on the product name and category.
 * Used in the Admin panel.
 */
export const generateProductDescription = async (name: string, category: string): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Write a short, appetizing, and catchy description (max 2 sentences) for a grocery product named "${name}" which is in the "${category}" category. Focus on freshness and quality.`;
    
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Fresh and high-quality product.";
  } catch (error) {
    console.error("Gemini API Error (Description):", error);
    return "Fresh and high-quality product.";
  }
};

/**
 * Suggests a recipe based on a list of ingredients (cart items).
 * Used in the User portal/Chat.
 */
export const getRecipeSuggestion = async (ingredients: string[]): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const ingredientList = ingredients.join(', ');
    const prompt = `I have the following ingredients in my grocery cart: ${ingredientList}. Suggest one simple and delicious recipe I can make using some of these ingredients. Provide the recipe name and a very brief instruction summary.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful AI Chef. Keep suggestions concise.",
      }
    });

    return response.text || "I couldn't find a recipe at the moment, but these ingredients look great!";
  } catch (error) {
    console.error("Gemini API Error (Recipe):", error);
    return "Sorry, I'm having trouble connecting to the recipe book right now.";
  }
};

/**
 * Smart search helper to match query to categories or synonyms.
 */
export const getSmartSearchTags = async (query: string): Promise<string[]> => {
   try {
    const model = 'gemini-2.5-flash';
    const prompt = `For the search query "${query}", list up to 5 relevant grocery related tags or synonyms as a JSON array of strings.`;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
   } catch (error) {
       console.error("Gemini API Error (Search):", error);
       return [];
   }
}