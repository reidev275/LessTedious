# LessTedious

Sql server access from node with Typescript types. 
The three main concepts in the library are the `Query<A>` interface, the `execute` function, and the `Config` interface.  The basic idea is that you have a config and a query that are passed to the `execute` function.  The `Query<A>` interface uses a phantom type parameter which allows the definition of the return type along with the query rather than at the time of query execution.

## Examples

For all of the examples, we'll use the following Student interface:

	interface Student {
		id: number;
		fullName: string;
		imageUrl: string;
	}

### Simple query

Just create a `Query<A>` value substituting the type of data you wish to be returned.  
Make sure your select list names match your interface properties in spelling and casing..

	const all: Query<Student> = {
		sql: "SELECT id, fullName, imageUrl from students with (nolock)"
	};

	const students: Student[] = execute(config, all);


### Query with Parameters

For queries that accept parameters you'll create a function that returns a `Query<A>` with the optional `params` property.

	export const byId = (id: number): Query<Student> => ({
		sql:
			"SELECT id, fullName, imageUrl " +
			"FROM students with (nolock) " +
			"WHERE id = @id",
		params: { id }
	});
