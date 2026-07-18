function PageHeader({ title, subtitle, action, back_link }) {
  return (
    <div className="page-header page-header-row">
      <div>
        {back_link}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default PageHeader;
