import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  problemText: string;
  studentSolution: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  characteristics: string[];
  preferredMethods: string[];
  dislikedMethods: string[];
  errorAnalysis: string;
  correctSolution: string;
  conceptGuide: string;
}

export const analyzeMathProblem = async (base64Images: string[]): Promise<AnalysisResult[]> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    제공된 이미지(수합된 여러 페이지일 수 있음)에서 손으로 쓴 수학 문제를 분석하십시오. 
    만약 이미지에 여러 개의 문제가 포함되어 있다면, 각각의 문제를 별도로 분석하여 배열 형태로 반환하십시오.

    각 문제에 대해 다음 정보를 추출하십시오:
    1. 원본 문제 텍스트를 추출하십시오. (problemText)
    2. 해당 문제에 대한 학생의 풀이 과정을 추출하십시오. (studentSolution)
    3. 학생이 도출한 최종 답을 확인하십시오. (studentAnswer)
    4. 실제 정답을 확인하십시오. (correctAnswer)
    5. 학생의 답이 정답과 일치하는지 판결하십시오 (맞으면 true, 틀리면 false). (isCorrect)
    6. 학생의 특징을 파악하십시오 (예: 신중함, 계산 실수 잦음, 풀이 과정 생략 등). (characteristics)
    7. 선호하는 풀이 방식(예: 대수적, 시각적/기하학적 등)을 파악하십시오. (preferredMethods)
    8. 기피하거나 사용하지 않는 풀이 방식을 파악하십시오. (dislikedMethods)
    9. 오류가 있다면 분석하고, 왜 학생의 답이 정답과 다른지 설명하십시오. (errorAnalysis)
    10. 올바른 풀이 과정을 제공하십시오. (correctSolution)
    11. 학생을 위한 핵심 개념 가이드를 제공하십시오. 주제와 관련된 검색 키워드나 교육 리소스(Khan Academy, YouTube 등) 링크를 포함하십시오. (conceptGuide)
    
    모든 분석 내용은 한국어로 작성하십시오. 결과는 JSON 배열 형식으로 반환하십시오.
  `;

  const parts: any[] = [{ text: prompt }];
  base64Images.forEach(base64 => {
    parts.push({ 
      inlineData: { 
        mimeType: "image/jpeg", 
        data: base64.split(",")[1] || base64 
      } 
    });
  });

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            problemText: { type: Type.STRING },
            studentSolution: { type: Type.STRING },
            studentAnswer: { type: Type.STRING },
            correctAnswer: { type: Type.STRING },
            isCorrect: { type: Type.BOOLEAN },
            characteristics: { type: Type.ARRAY, items: { type: Type.STRING } },
            preferredMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
            dislikedMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
            errorAnalysis: { type: Type.STRING },
            correctSolution: { type: Type.STRING },
            conceptGuide: { type: Type.STRING },
          },
          required: ["problemText", "studentSolution", "studentAnswer", "correctAnswer", "isCorrect", "characteristics", "preferredMethods", "dislikedMethods", "errorAnalysis", "correctSolution", "conceptGuide"]
        }
      }
    }
  });

  const parsed = JSON.parse(response.text);
  return Array.isArray(parsed) ? parsed : [parsed];
};

export const generateSimilarProblem = async (originalProblem: string, concept: string): Promise<{ problem: string; solution: string }> => {
  const model = "gemini-3-flash-preview";
  const prompt = `다음 원본 문제: "${originalProblem}"와 핵심 개념: "${concept}"을 바탕으로, 학생의 연습을 위한 새로운 유사 수학 문제를 만드십시오. 문제 텍스트(problem)와 전체 풀이 과정(solution)을 제공하십시오. 모든 내용은 한국어로 작성하고 JSON으로 반환하십시오.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          problem: { type: Type.STRING },
          solution: { type: Type.STRING },
        },
        required: ["problem", "solution"]
      }
    }
  });

  return JSON.parse(response.text);
};
