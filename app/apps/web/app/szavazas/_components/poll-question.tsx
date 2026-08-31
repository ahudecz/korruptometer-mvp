export function PollQuestion({
  text,
  minSelect,
  maxSelect,
}: {
  text: string;
  minSelect: number;
  maxSelect: number;
}) {
  return (
    <header className="poll-question">
      <h1 className="poll-question-text">{text}</h1>
      <p className="poll-question-hint">
        {minSelect === maxSelect
          ? `Pontosan ${maxSelect} ügyre adható le szavazat.`
          : `Maximum ${maxSelect} ügyre adható le szavazat.`}
      </p>
      <dl className="poll-legend">
        <div className="poll-legend-item">
          <dt><span className="poll-option-card-tag poll-option-card-tag--marquee">Kiemelt</span></dt>
          <dd>Nagy közfigyelmű ügy, amelyben már történt feljelentés vagy folyik eljárás — ez nem zárja ki, hogy az NVVH saját hatáskörébe vonja.</dd>
        </div>
        <div className="poll-legend-item">
          <dt><span className="poll-option-card-tag poll-option-card-tag--eu">EU</span></dt>
          <dd>Az ügyben uniós forrás is érintett — ezt elsősorban az Európai Ügyészség vizsgálhatja.</dd>
        </div>
        <div className="poll-legend-item">
          <dt><span className="poll-option-card-tag poll-option-card-tag--meta">Terület</span></dt>
          <dd>Nem egyetlen konkrét ügy, hanem egy egész vizsgálati terület — egy jellemző példaeset szerepel forrással.</dd>
        </div>
      </dl>
    </header>
  );
}
