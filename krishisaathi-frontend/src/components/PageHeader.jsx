function PageHeader({ title, subtitle, action, back_link }) {
  return (
    <div className="page-header page-header-row">
      <div className="page-header-copy">
        {back_link}
        <h2>{title || '\u00A0'}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  );
}

export default PageHeader;
