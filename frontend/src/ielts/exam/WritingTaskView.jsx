import { RichHtml } from "../lib/richHtml.jsx";

// The prompt side of a writing task — shared by the exam, the admin editor
// preview and the admin attempt review.
export function WritingTaskView({ task, preview = false }) {
  return (
    <div className="ie-writing-preview">
      <h3>{task.title}</h3>
      <p className="ie-wp-line">You should spend about {task.minutes} minutes on this task.</p>
      {task.task === 2 && <p className="ie-wp-line">Write about the following topic:</p>}
      <div className={`ie-prompt-box ${preview ? "" : "ie-prompt-box--exam"}`}>
        <RichHtml html={task.questionHtml} />
      </div>
      {task.task === 2 && <p className="ie-wp-line">Give reasons for your answer and include any relevant examples from your own knowledge or experience.</p>}
      <p className="ie-wp-line">Write at least {task.minWords} words.</p>
      {task.image?.url && <img src={task.image.url} alt="Task illustration" />}
    </div>
  );
}
