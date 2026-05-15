document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('text-input');
  const analyzeBtn = document.getElementById('analyze-btn');
  const errorBox = document.getElementById('error-box');
  const errorMessage = document.getElementById('error-message');
  const resultCard = document.getElementById('result-card');
  const sentimentBadge = document.getElementById('sentiment-badge');
  const confidenceFill = document.getElementById('confidence-fill');
  const confidenceText = document.getElementById('confidence-text');
  const reasonText = document.getElementById('reason-text');

  const sentimentMap = {
    'positive': '긍정',
    'negative': '부정',
    'neutral': '중립'
  };

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
    resultCard.classList.add('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }

  function showResult(data) {
    const { sentiment, confidence, reason } = data;
    
    // Set Sentiment
    sentimentBadge.textContent = sentimentMap[sentiment] || sentiment;
    sentimentBadge.className = `sentiment-badge ${sentiment}`;
    
    // Set Confidence
    confidenceFill.style.width = `${confidence}%`;
    confidenceText.textContent = `${confidence}%`;
    
    // Set Reason
    reasonText.textContent = reason;

    resultCard.classList.remove('hidden');
  }

  analyzeBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    
    if (!text) {
      showError('텍스트를 입력해주세요.');
      return;
    }

    if (text.length > 1000) {
      showError('텍스트는 1000자 이내로 입력해주세요.');
      return;
    }

    hideError();
    resultCard.classList.add('hidden');
    
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '서버 응답 오류가 발생했습니다.');
      }

      showResult(data);
    } catch (err) {
      showError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '분석하기';
    }
  });
});
