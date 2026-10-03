export default function PageHeader({ eyebrow, title, description, action, children }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="page-heading-actions">{children}{action}</div></div>;
}
