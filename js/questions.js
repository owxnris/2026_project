// questions.json의 문제를 섞어서 차례로 내고, 다 쓰면 다시 섞어 반복 출제한다.
let bank = [];
let deck = [];

export function setQuestions(list) {
  bank = list;
  deck = [];
}

export function nextQuestion() {
  if (deck.length === 0) deck = Phaser.Utils.Array.Shuffle([...bank]);
  return deck.pop();
}
