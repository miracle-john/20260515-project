const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 환경변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// OpenAI 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase 초기화
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_URL.includes('placeholder') && !process.env.SUPABASE_URL.includes('your_')) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// API 라우트
app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    // 검증
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: '유효한 텍스트를 입력해주세요.' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: '텍스트는 1000자 이내로 입력해주세요.' });
    }

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "너는 한국어 텍스트 감성 분석기다. 사용자 텍스트를 positive, negative, neutral 중 하나로 분류한다. confidence는 0부터 100 사이의 정수로 작성한다. reason은 한국어로 한 문장만 작성한다. 과장하지 말고 텍스트 근거만 사용한다. 반드시 JSON 형식으로 응답해라."
        },
        {
          role: "user",
          content: text.trim()
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const responseContent = completion.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseErr) {
      console.error('OpenAI 응답 파싱 오류:', responseContent);
      throw new Error('응답 파싱 오류');
    }

    // 결과 정규화 검증
    const validSentiments = ['positive', 'negative', 'neutral'];
    const sentiment = validSentiments.includes(result.sentiment) ? result.sentiment : 'neutral';
    const confidence = typeof result.confidence === 'number' ? Math.min(Math.max(result.confidence, 0), 100) : 0;
    const reason = result.reason || '분석 이유를 가져오지 못했습니다.';

    // Supabase 저장
    if (supabase) {
      try {
        const { error } = await supabase
          .from('sentiment_logs')
          .insert([
            {
              input_text: text.trim(),
              sentiment,
              confidence,
              reason
            }
          ]);
        if (error) {
          console.error('Supabase 저장 실패:', error.message);
        }
      } catch (dbErr) {
        console.error('Supabase 연동 중 오류:', dbErr);
      }
    } else {
      console.warn('Supabase 설정이 없어 데이터베이스에 저장하지 않습니다.');
    }

    // 응답 반환
    return res.json({
      sentiment,
      confidence,
      reason
    });

  } catch (error) {
    console.error('감성 분석 중 오류:', error);
    return res.status(500).json({ error: '분석 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

// 서버 실행
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder')) {
      console.warn('경고: OPENAI_API_KEY가 올바르게 설정되지 않은 것 같습니다. (.env 확인 필요)');
    }
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder')) {
      console.warn('경고: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않아 DB 저장이 동작하지 않을 수 있습니다. (.env 확인 필요)');
    }
  });
}

module.exports = app;
